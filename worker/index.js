/* ============================================================
   potoksite — Cloudflare Worker
   Закрытый курс «ПОТОК»: авторизация через Telegram + прокси статики

   Схема:
   - Статика берётся с GitHub Pages (UPSTREAM) и проксируется дальше.
   - HTML-страницы отдаются ТОЛЬКО при валидной сессии, иначе — gate-страница.
   - Вход: внутри Telegram Mini App initData проверяется по токену бота,
     затем getChatMember(чат курса) подтверждает членство → cookie-сессия.
   - Для браузера: после входа в TG выдаётся подписанная ссылка /api/activate?t=...
     (открываешь её в Chrome на том же устройстве — ставится cookie).

   Секреты (wrangler secret put): BOT_TOKEN, SESSION_SECRET
   ============================================================ */

const UPSTREAM = "https://programmcompose.github.io/potoksite";
const COURSE_CHAT_ID = "-1003906004104"; // IY / 18 Поток по Созданию Музыки
const SESSION_TTL_DAYS = 7;              // срок жизни сессии (в TG переподключение автоматическое)
const COOKIE_NAME = "potok_session";

/* ---------- WebCrypto helpers ---------- */

const enc = new TextEncoder();

async function hmacSign(key, message) {
  const keyBytes = typeof key === "string" ? enc.encode(key) : key;
  const keyObj = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", keyObj, typeof message === "string" ? enc.encode(message) : message);
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

/* ---------- Сессионный токен: payload.sig (HMAC-SHA256) ---------- */

async function makeSessionToken(user, env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 86400;
  const payload = b64url(enc.encode(JSON.stringify({
    uid: user.id,
    name: user.first_name || "",
    uname: user.username || null,
    lname: user.last_name || null,
    photo: user.photo_url || null,
    exp
  })));
  const sig = await hmacSign(env.SESSION_SECRET, payload);
  return `${payload}.${b64url(sig)}`;
}

async function verifySessionToken(token, env) {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected;
  try { expected = b64url(await hmacSign(env.SESSION_SECRET, payload)); } catch { return null; }
  // сравнение без раннего выхода (timing-safe)
  const a = fromB64url(sig), b = fromB64url(expected);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!data.uid || !data.exp || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch { return null; }
}

function sessionCookie(token, maxAgeSec) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSec}; Secure; HttpOnly; SameSite=Lax`;
}

/* ---------- Проверка Telegram initData (официальная схема) ---------- */

async function validateInitData(initData, env) {
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash");
  if (!hash) return { error: "no_hash" };
  params.delete("hash");

  // data_check_string: пары key=value, отсортированные по ключу, через \n
  const lines = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  // secret_key = HMAC_sha256(key=BotToken, msg="WebAppData")
  const secretKey = await hmacSign(env.BOT_TOKEN, "WebAppData");
  // hash = HMAC_sha256(key=secret_key, msg=data_check_string)
  const calculated = toHex(await hmacSign(secretKey, lines));

  if (calculated.length !== hash.length || calculated !== hash) return { error: "hash_mismatch" };

  // свежесть: не старше суток
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) return { error: "stale_auth_date" };

  try {
    const user = JSON.parse(params.get("user"));
    if (!user || !user.id) return { error: "bad_user" };
    return { user };
  } catch { return { error: "bad_user_parse" }; }
}

/* ---------- Проверка членства в чате курса ---------- */

async function isCourseMember(userId, env) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: COURSE_CHAT_ID, user_id: userId }),
    });
  } catch (e) {
    return { ok: false, reason: `fetch error: ${e && e.message || e}` };
  }
  if (!res.ok) return { ok: false, reason: `bot api ${res.status}` };
  const data = await res.json();
  if (!data.ok) return { ok: false, reason: data.description || "getChatMember failed" };
  // restricted — тоже участник (ограниченные права), доступ даём
  const allowed = ["creator", "administrator", "member", "restricted"];
  return { ok: allowed.includes(data.result.status), status: data.result.status };
}

/* ---------- API ---------- */

async function handleAuth(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  let v;
  try {
    v = await validateInitData(body.initData || "", env);
  } catch (e) {
    return json({ ok: false, error: `validate_error: ${e && e.message || e}` }, 500);
  }
  if (!v.user) return json({ ok: false, error: "init_data_invalid", detail: v.error }, 401);
  const user = v.user;

  const member = await isCourseMember(user.id, env);
  if (!member.ok) {
    return json({ ok: false, error: "not_member", detail: member.reason || member.status }, 403);
  }

  const token = await makeSessionToken(user, env);
  const res = json({ ok: true, name: user.first_name, token });
  res.headers.set("set-cookie", sessionCookie(token, SESSION_TTL_DAYS * 86400));
  return res;
}

// Диагностика initData (без утечки секретов): что пришло и почему не сошёлся hash
async function handleDbgInitData(request, env) {
  if (request.method !== "POST") return json({ ok: false }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const initData = body.initData || "";
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  let computed = "";
  try {
    const secretKey = await hmacSign(env.BOT_TOKEN, "WebAppData");
    computed = toHex(await hmacSign(secretKey, lines));
  } catch (e) { computed = `error: ${e && e.message || e}`; }
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch {}
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  return json({
    ok: true,
    param_names: [...new URLSearchParams(initData).keys()],
    user_id: user && user.id,
    first_name: user && user.first_name,
    username: user && user.username,
    auth_date_age_sec: Math.floor(Date.now() / 1000) - authDate,
    hash_len: hash.length,
    provided_hash_prefix: hash.slice(0, 12),
    computed_hash_prefix: String(computed).slice(0, 12),
    match: computed === hash,
  });
}

// ---------- API: Login Widget (telegram.org/js/telegram-widget.js) ----------
// Legacy-схема (core.telegram.org/widgets/login-legacy):
//   secret_key = SHA256(bot_token);  hash = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
async function handleAuthWidget(request, env) {
  if (request.method !== "POST") return json({ ok: false }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const user = body.user || {};
  const hash = typeof user.hash === "string" ? user.hash : "";
  if (!hash) return json({ ok: false, error: "no_hash" }, 401);

  const dcs = Object.keys(user).filter((k) => k !== "hash").sort().map((k) => `${k}=${user[k]}`).join("\n");
  let computed;
  try {
    const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(env.BOT_TOKEN));
    computed = toHex(await hmacSign(secretKey, dcs));
  } catch (e) {
    return json({ ok: false, error: `validate_error: ${e && e.message || e}` }, 500);
  }
  if (computed.length !== hash.length || computed !== hash) {
    const tok = env.BOT_TOKEN || "";
    return json({ ok: false, error: "hash_mismatch", detail: `scheme=sha256key toklen=${tok.length} tok8=${tok.slice(0, 8)} dcs_len=${dcs.length}` }, 401);
  }

  const uid = Number(user.id);
  if (!uid) return json({ ok: false, error: "bad_user" }, 401);

  const member = await isCourseMember(uid, env);
  if (!member.ok) {
    return json({ ok: false, error: "not_member", detail: member.reason || member.status }, 403);
  }

  const token = await makeSessionToken(
    { id: uid, first_name: user.first_name, username: user.username, last_name: user.last_name, photo_url: user.photo_url },
    env
  );
  const res = json({ ok: true, name: user.first_name, token });
  res.headers.set("set-cookie", sessionCookie(token, SESSION_TTL_DAYS * 86400));
  return res;
}

// Активация сессии в обычном браузере по подписанной ссылке (скопирована из Telegram)
async function handleActivate(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const session = await verifySessionToken(token || "", env);
  if (!session) return json({ ok: false, error: "invalid_link" }, 401);
  const res = new Response("", { status: 302 });
  res.headers.set("location", "/");
  res.headers.set("set-cookie", sessionCookie(token, (session.exp - Math.floor(Date.now() / 1000))));
  return res;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* ---------- Gate-страница (показ вместо контента без сессии) ---------- */

const GATE_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ПОТОК — вход</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0f1115; color: #e8eaed;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px;
  }
  .card { max-width: 420px; width: 100%; text-align: center; }
  .logo { font-size: 40px; font-weight: 800; letter-spacing: .35em; color: #ff7a1a; margin-bottom: 8px; }
  h1 { font-size: 20px; margin-bottom: 12px; }
  p { color: #9aa0a6; font-size: 14px; line-height: 1.55; margin-bottom: 16px; white-space: pre-line; }
  .btn {
    display: inline-block; width: 100%; padding: 13px 18px; border-radius: 10px; border: 0;
    background: #ff7a1a; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px;
    text-decoration: none; text-align: center;
  }
  .btn.secondary { background: transparent; border: 1px solid #3c4043; color: #e8eaed; }
  .status { font-size: 14px; margin-top: 14px; min-height: 20px; }
  .ok { color: #34a853; } .err { color: #f28b82; }
  input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #3c4043; background: #171a1f; color: #e8eaed; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">ПОТОК</div>
  <h1 id="title">Закрытый курс — только для участников чата</h1>
  <p id="hint"></p>
  <button class="btn" id="tgBtn" style="display:none">Войти через Telegram</button>
  <div id="widgetBox" style="display:none; margin-top:8px;">
    <script src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="iy_potok_bot" data-size="large" data-radius="10" data-onauth="function(user){window.onTgAuth(user);}"></script>
  </div>
  <button class="btn" id="fallbackBtn" style="display:none">Войти через Telegram</button>
  <button class="btn secondary" id="copyBtn" style="display:none">Скопировать ссылку для браузера</button>
  <div class="status" id="status"></div>
</div>
<script>
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  var statusEl = document.getElementById('status');

  function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status ' + (cls || ''); }

  // Callback Login Widget: пользователь подтвердил вход в Telegram
  window.onTgAuth = function (user) {
    setStatus('Проверяем, состоишь ли ты в чате курса…');
    fetch('/api/auth-widget', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.d.ok) { var err = new Error(x.d.error || 'auth failed'); err.detail = x.d.detail; throw err; }
        document.getElementById('title').textContent = 'Привет, ' + x.d.name + '!';
        document.getElementById('hint').textContent = 'Доступ подтверждён.';
        var tgBtn = document.getElementById('tgBtn');
        tgBtn.style.display = 'block';
        tgBtn.textContent = 'Открыть курс →';
        tgBtn.onclick = function () { location.href = '/'; };
      })
      .catch(function (e) {
        var msg;
        if (e.message === 'not_member') msg = 'Ты не состоишь в чате курса. Вступи в чат «Поток» и обнови страницу.';
        else msg = 'Не удалось войти (' + e.message + (e.detail ? ': ' + e.detail : '') + '). Попробуй ещё раз.';
        setStatus(msg, 'err');
      });
  };

  if (tg && tg.initData) {
    // === Внутри Telegram: автоматический вход ===
    document.getElementById('hint').textContent = 'Проверяем, состоишь ли ты в чате курса…';
    setStatus('');
    fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.d.ok) { var err = new Error(x.d.error || 'auth failed'); err.detail = x.d.detail; throw err; }
        document.getElementById('title').textContent = 'Привет, ' + x.d.name + '!';
        document.getElementById('hint').textContent = 'Доступ подтверждён. Открой курс в Telegram или скопируй ссылку для браузера.';
        var tgBtn = document.getElementById('tgBtn');
        tgBtn.style.display = 'block';
        tgBtn.textContent = 'Открыть курс →';
        tgBtn.onclick = function () { location.href = '/'; };
        var copyBtn = document.getElementById('copyBtn');
        copyBtn.style.display = 'block';
        copyBtn.onclick = function () {
          var link = location.origin + '/api/activate?t=' + x.d.token;
          (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
            .then(function () { setStatus('Ссылка скопирована — открой её в браузере', 'ok'); })
            .catch(function () { prompt('Скопируй ссылку:', link); });
        };
      })
      .catch(function (e) {
        var msg;
        if (e.message === 'not_member') msg = 'Ты не состоишь в чате курса. Вступи в чат «Поток» и обнови страницу.';
        else if (e.message === 'init_data_invalid') {
          msg = 'Не удалось войти (' + (e.detail || 'init_data_invalid') + '). Открой сайт заново через кнопку бота.';
          setStatus(msg, 'err');
          // диагностика: что именно пришло в initData
          fetch('/api/dbg-initdata', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) return;
              setStatus(msg + ' Диагностика: user_id=' + d.user_id + ', name=' + (d.first_name || '?') + ', age=' + d.auth_date_age_sec + 's, params=[' + d.param_names.join(',') + '], hash ' + d.provided_hash_prefix + '… ≠ ' + d.computed_hash_prefix + '…', 'err');
            })
            .catch(function () {});
          document.getElementById('widgetBox').style.display = 'block';
          return;
        }
        else msg = 'Не удалось войти (' + e.message + '). Попробуй обновить страницу или войди кнопкой ниже.';
        setStatus(msg, 'err');
        document.getElementById('widgetBox').style.display = 'block';
      });
  } else {
    // === Обычный браузер: Login Widget + запасные пути ===
    document.getElementById('hint').textContent = 'Нажми кнопку — откроется окно Telegram, подтверди вход под своим аккаунтом и ты сразу внутри.';
    document.getElementById('widgetBox').style.display = 'block';

    // Возврат с oauth.telegram.org после редиректа: #tgAuthResult=...
    var mHash = location.hash.match(/[#\?\&]tgAuthResult=([A-Za-z0-9\-_=]*)$/);
    if (mHash && mHash[1]) {
      try {
        var b64 = mHash[1].replace(/-/g, '+').replace(/_/g, '/');
        var pad = b64.length % 4;
        if (pad > 1) b64 += new Array(5 - pad).join('=');
        var bin = window.atob(b64);
        var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
        history.replaceState(null, '', location.pathname + location.search);
        window.onTgAuth(JSON.parse(new TextDecoder('utf-8').decode(bytes)));
      } catch (e) {
        setStatus('Не удалось разобрать данные входа. Попробуй ещё раз.', 'err');
      }
    } else {
      // Если виджет не отрисовался за 4 секунды — показываем запасную кнопку
      setTimeout(function () {
        var box = document.getElementById('widgetBox');
        if (!box || !box.querySelector('iframe')) {
          setStatus('Кнопка Telegram не загрузилась. Воспользуйся оранжевой кнопкой ниже.', 'err');
          document.getElementById('fallbackBtn').style.display = 'block';
        }
      }, 4000);
    }

    // Запасная кнопка: попап через JS виджета, либо редирект на oauth.telegram.org
    var fb = document.getElementById('fallbackBtn');
    if (fb) {
      fb.addEventListener('click', function () {
        var authUrl = 'https://oauth.telegram.org/auth?bot_id=8648040041&origin=' + encodeURIComponent(location.origin) + '&return_to=' + encodeURIComponent(location.href);
        if (window.Telegram && Telegram.Login && typeof Telegram.Login.auth === 'function') {
          setStatus('Открываем окно входа в Telegram…');
          try {
            Telegram.Login.auth({ bot_id: 8648040041 }, function (user) { window.onTgAuth(user); });
          } catch (e) { location.href = authUrl; }
        } else {
          location.href = authUrl;
        }
      });
    }
  }
})();
</script>
</body>
</html>`;

/* ---------- Прокси статики с GitHub Pages ---------- */

async function proxyToUpstream(request, url) {
  const upstreamUrl = UPSTREAM + (url.pathname === "/" ? "/" : url.pathname) + url.search;
  const res = await fetch(upstreamUrl, { headers: { "accept-encoding": "identity" } });
  const headers = new Headers(res.headers);
  // убираем заголовки, которые не совпадают с новым телом/потоком
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("x-robots-tag", "noindex");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/* ---------- Что требует сессию, а что открыто ---------- */

function isPublicPath(pathname) {
  if (pathname === "/robots.txt") return true;          // noindex должен быть публичным
  if (pathname.startsWith("/api/")) return true;        // API само проверяет
  if (pathname.startsWith("/assets/")) return true;     // css/js/шрифты/картинки темы
  return false;
}

/* ---------- Main ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth") return handleAuth(request, env);
    if (url.pathname === "/api/dbg-initdata") return handleDbgInitData(request, env);
    if (url.pathname === "/api/auth-widget") return handleAuthWidget(request, env);
    if (url.pathname === "/api/activate") return handleActivate(request, env);

    // Открытые пути — сразу проксируем
    if (isPublicPath(url.pathname)) {
      return proxyToUpstream(request, url);
    }

    // Остальное (HTML-страницы курса) — только с валидной сессией
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
    const session = m ? await verifySessionToken(m[1], env) : null;

    if (session) {
      const res = await proxyToUpstream(request, url);
      // В HTML-страницы вставляем данные вошедшего пользователя,
      // чтобы статистика/профиль знали имя и Telegram ID (браузерный вход через виджет)
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        try {
          let html = await res.text();
          const userJs = JSON.stringify({
            id: session.uid,
            first_name: session.name || null,
            username: session.uname || null,
            last_name: session.lname || null,
            photo_url: session.photo || null
          });
          const tag = `<script>window.POTOK_USER=${userJs};</script>`;
          html = html.includes("</head>") ? html.replace("</head>", tag + "</head>") : tag + html;
          res.headers.set("cache-control", "no-store"); // страница персональная — не кэшировать
          return new Response(html, { status: res.status, headers: res.headers });
        } catch (e) {
          /* если тело уже съедено/ошибка — отдаём оригинальный ответ */
        }
      }
      return res;
    }

    // Нет сессии → gate-страница (200: это не ошибка, а экран входа)
    const res = new Response(GATE_PAGE, { status: 200 });
    res.headers.set("content-type", "text/html; charset=utf-8");
    res.headers.set("cache-control", "no-store");
    res.headers.set("x-robots-tag", "noindex");
    return res;
  },
};
