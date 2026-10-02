var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var UPSTREAM = "https://programmcompose.github.io/potoksite";
var COURSE_CHAT_ID = "-1003906004104";
var SESSION_TTL_DAYS = 7;
var COOKIE_NAME = "potok_session";
var enc = new TextEncoder();
async function hmacSign(key, message) {
  const keyBytes = typeof key === "string" ? enc.encode(key) : key;
  const keyObj = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", keyObj, typeof message === "string" ? enc.encode(message) : message);
}
__name(hmacSign, "hmacSign");
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
var b64url = /* @__PURE__ */ __name((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64url");
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
__name(fromB64url, "fromB64url");
async function makeSessionToken(user, env) {
  const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_DAYS * 86400;
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
__name(makeSessionToken, "makeSessionToken");
async function verifySessionToken(token, env) {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected;
  try {
    expected = b64url(await hmacSign(env.SESSION_SECRET, payload));
  } catch {
    return null;
  }
  const a = fromB64url(sig), b = fromB64url(expected);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!data.uid || !data.exp || data.exp * 1e3 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
__name(verifySessionToken, "verifySessionToken");
function sessionCookie(token, maxAgeSec) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSec}; Secure; HttpOnly; SameSite=Lax`;
}
__name(sessionCookie, "sessionCookie");
async function validateInitData(initData, env) {
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash");
  if (!hash) return { error: "no_hash" };
  params.delete("hash");
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = await hmacSign(env.BOT_TOKEN, "WebAppData");
  const calculated = toHex(await hmacSign(secretKey, lines));
  if (calculated.length !== hash.length || calculated !== hash) return { error: "hash_mismatch" };
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (!authDate || Math.floor(Date.now() / 1e3) - authDate > 86400) return { error: "stale_auth_date" };
  try {
    const user = JSON.parse(params.get("user"));
    if (!user || !user.id) return { error: "bad_user" };
    return { user };
  } catch {
    return { error: "bad_user_parse" };
  }
}
__name(validateInitData, "validateInitData");
async function isCourseMember(userId, env) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: COURSE_CHAT_ID, user_id: userId })
    });
  } catch (e) {
    return { ok: false, reason: `fetch error: ${e && e.message || e}` };
  }
  if (!res.ok) return { ok: false, reason: `bot api ${res.status}` };
  const data = await res.json();
  if (!data.ok) return { ok: false, reason: data.description || "getChatMember failed" };
  const allowed = ["creator", "administrator", "member", "restricted"];
  return { ok: allowed.includes(data.result.status), status: data.result.status };
}
__name(isCourseMember, "isCourseMember");
async function handleAuth(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
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
__name(handleAuth, "handleAuth");
async function handleDbgInitData(request, env) {
  if (request.method !== "POST") return json({ ok: false }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const initData = body.initData || "";
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  let computed = "";
  try {
    const secretKey = await hmacSign(env.BOT_TOKEN, "WebAppData");
    computed = toHex(await hmacSign(secretKey, lines));
  } catch (e) {
    computed = `error: ${e && e.message || e}`;
  }
  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
  }
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  return json({
    ok: true,
    param_names: [...new URLSearchParams(initData).keys()],
    user_id: user && user.id,
    first_name: user && user.first_name,
    username: user && user.username,
    auth_date_age_sec: Math.floor(Date.now() / 1e3) - authDate,
    hash_len: hash.length,
    provided_hash_prefix: hash.slice(0, 12),
    computed_hash_prefix: String(computed).slice(0, 12),
    match: computed === hash
  });
}
__name(handleDbgInitData, "handleDbgInitData");
async function handleAuthWidget(request, env) {
  if (request.method !== "POST") return json({ ok: false }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
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
__name(handleAuthWidget, "handleAuthWidget");
async function handleActivate(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const session = await verifySessionToken(token || "", env);
  if (!session) return json({ ok: false, error: "invalid_link" }, 401);
  const res = new Response("", { status: 302 });
  res.headers.set("location", "/");
  res.headers.set("set-cookie", sessionCookie(token, session.exp - Math.floor(Date.now() / 1e3)));
  return res;
}
__name(handleActivate, "handleActivate");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
__name(json, "json");
var GATE_PAGE = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>\u041F\u041E\u0422\u041E\u041A \u2014 \u0432\u0445\u043E\u0434</title>
<script src="https://telegram.org/js/telegram-web-app.js"><\/script>
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
  <div class="logo">\u041F\u041E\u0422\u041E\u041A</div>
  <h1 id="title">\u0417\u0430\u043A\u0440\u044B\u0442\u044B\u0439 \u043A\u0443\u0440\u0441 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u0447\u0430\u0442\u0430</h1>
  <p id="hint"></p>
  <button class="btn" id="tgBtn" style="display:none">\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram</button>
  <div id="widgetBox" style="display:none; margin-top:8px;">
    <script src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="iy_potok_bot" data-size="large" data-radius="10" data-onauth="function(user){window.onTgAuth(user);}"><\/script>
  </div>
  <button class="btn" id="fallbackBtn" style="display:none">\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Telegram</button>
  <button class="btn secondary" id="copyBtn" style="display:none">\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430</button>
  <div class="status" id="status"></div>
</div>
<script>
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  var statusEl = document.getElementById('status');

  function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status ' + (cls || ''); }

  // Callback Login Widget: \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0432\u0445\u043E\u0434 \u0432 Telegram
  window.onTgAuth = function (user) {
    setStatus('\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C, \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u043B\u0438 \u0442\u044B \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430\u2026');
    fetch('/api/auth-widget', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.d.ok) { var err = new Error(x.d.error || 'auth failed'); err.detail = x.d.detail; throw err; }
        document.getElementById('title').textContent = '\u041F\u0440\u0438\u0432\u0435\u0442, ' + x.d.name + '!';
        document.getElementById('hint').textContent = '\u0414\u043E\u0441\u0442\u0443\u043F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D.';
        var tgBtn = document.getElementById('tgBtn');
        tgBtn.style.display = 'block';
        tgBtn.textContent = '\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441 \u2192';
        tgBtn.onclick = function () { location.href = '/'; };
      })
      .catch(function (e) {
        var msg;
        if (e.message === 'not_member') msg = '\u0422\u044B \u043D\u0435 \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430. \u0412\u0441\u0442\u0443\u043F\u0438 \u0432 \u0447\u0430\u0442 \xAB\u041F\u043E\u0442\u043E\u043A\xBB \u0438 \u043E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443.';
        else msg = '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 (' + e.message + (e.detail ? ': ' + e.detail : '') + '). \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.';
        setStatus(msg, 'err');
      });
  };

  if (tg && tg.initData) {
    // === \u0412\u043D\u0443\u0442\u0440\u0438 Telegram: \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0432\u0445\u043E\u0434 ===
    document.getElementById('hint').textContent = '\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C, \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u043B\u0438 \u0442\u044B \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430\u2026';
    setStatus('');
    fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.d.ok) { var err = new Error(x.d.error || 'auth failed'); err.detail = x.d.detail; throw err; }
        document.getElementById('title').textContent = '\u041F\u0440\u0438\u0432\u0435\u0442, ' + x.d.name + '!';
        document.getElementById('hint').textContent = '\u0414\u043E\u0441\u0442\u0443\u043F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D. \u041E\u0442\u043A\u0440\u043E\u0439 \u043A\u0443\u0440\u0441 \u0432 Telegram \u0438\u043B\u0438 \u0441\u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.';
        var tgBtn = document.getElementById('tgBtn');
        tgBtn.style.display = 'block';
        tgBtn.textContent = '\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441 \u2192';
        tgBtn.onclick = function () { location.href = '/'; };
        var copyBtn = document.getElementById('copyBtn');
        copyBtn.style.display = 'block';
        copyBtn.onclick = function () {
          var link = location.origin + '/api/activate?t=' + x.d.token;
          (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
            .then(function () { setStatus('\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u2014 \u043E\u0442\u043A\u0440\u043E\u0439 \u0435\u0451 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435', 'ok'); })
            .catch(function () { prompt('\u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0441\u0441\u044B\u043B\u043A\u0443:', link); });
        };
      })
      .catch(function (e) {
        var msg;
        if (e.message === 'not_member') msg = '\u0422\u044B \u043D\u0435 \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430. \u0412\u0441\u0442\u0443\u043F\u0438 \u0432 \u0447\u0430\u0442 \xAB\u041F\u043E\u0442\u043E\u043A\xBB \u0438 \u043E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443.';
        else if (e.message === 'init_data_invalid') {
          msg = '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 (' + (e.detail || 'init_data_invalid') + '). \u041E\u0442\u043A\u0440\u043E\u0439 \u0441\u0430\u0439\u0442 \u0437\u0430\u043D\u043E\u0432\u043E \u0447\u0435\u0440\u0435\u0437 \u043A\u043D\u043E\u043F\u043A\u0443 \u0431\u043E\u0442\u0430.';
          setStatus(msg, 'err');
          // \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430: \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u0438\u0448\u043B\u043E \u0432 initData
          fetch('/api/dbg-initdata', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) return;
              setStatus(msg + ' \u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430: user_id=' + d.user_id + ', name=' + (d.first_name || '?') + ', age=' + d.auth_date_age_sec + 's, params=[' + d.param_names.join(',') + '], hash ' + d.provided_hash_prefix + '\u2026 \u2260 ' + d.computed_hash_prefix + '\u2026', 'err');
            })
            .catch(function () {});
          document.getElementById('widgetBox').style.display = 'block';
          return;
        }
        else msg = '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 (' + e.message + '). \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438\u043B\u0438 \u0432\u043E\u0439\u0434\u0438 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043D\u0438\u0436\u0435.';
        setStatus(msg, 'err');
        document.getElementById('widgetBox').style.display = 'block';
      });
  } else {
    // === \u041E\u0431\u044B\u0447\u043D\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440: Login Widget + \u0437\u0430\u043F\u0430\u0441\u043D\u044B\u0435 \u043F\u0443\u0442\u0438 ===
    document.getElementById('hint').textContent = '\u041D\u0430\u0436\u043C\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u2014 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u043E\u043A\u043D\u043E Telegram, \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438 \u0432\u0445\u043E\u0434 \u043F\u043E\u0434 \u0441\u0432\u043E\u0438\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u043E\u043C \u0438 \u0442\u044B \u0441\u0440\u0430\u0437\u0443 \u0432\u043D\u0443\u0442\u0440\u0438.';
    document.getElementById('widgetBox').style.display = 'block';

    // \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0441 oauth.telegram.org \u043F\u043E\u0441\u043B\u0435 \u0440\u0435\u0434\u0438\u0440\u0435\u043A\u0442\u0430: #tgAuthResult=...
    var mHash = location.hash.match(/[#?&]tgAuthResult=([A-Za-z0-9-_=]*)$/);
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
        setStatus('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.', 'err');
      }
    } else {
      // \u0415\u0441\u043B\u0438 \u0432\u0438\u0434\u0436\u0435\u0442 \u043D\u0435 \u043E\u0442\u0440\u0438\u0441\u043E\u0432\u0430\u043B\u0441\u044F \u0437\u0430 4 \u0441\u0435\u043A\u0443\u043D\u0434\u044B \u2014 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u043C \u0437\u0430\u043F\u0430\u0441\u043D\u0443\u044E \u043A\u043D\u043E\u043F\u043A\u0443
      setTimeout(function () {
        var box = document.getElementById('widgetBox');
        if (!box || !box.querySelector('iframe')) {
          setStatus('\u041A\u043D\u043E\u043F\u043A\u0430 Telegram \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0430\u0441\u044C. \u0412\u043E\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0441\u044F \u043E\u0440\u0430\u043D\u0436\u0435\u0432\u043E\u0439 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043D\u0438\u0436\u0435.', 'err');
          document.getElementById('fallbackBtn').style.display = 'block';
        }
      }, 4000);
    }

    // \u0417\u0430\u043F\u0430\u0441\u043D\u0430\u044F \u043A\u043D\u043E\u043F\u043A\u0430: \u043F\u043E\u043F\u0430\u043F \u0447\u0435\u0440\u0435\u0437 JS \u0432\u0438\u0434\u0436\u0435\u0442\u0430, \u043B\u0438\u0431\u043E \u0440\u0435\u0434\u0438\u0440\u0435\u043A\u0442 \u043D\u0430 oauth.telegram.org
    var fb = document.getElementById('fallbackBtn');
    if (fb) {
      fb.addEventListener('click', function () {
        var authUrl = 'https://oauth.telegram.org/auth?bot_id=8648040041&origin=' + encodeURIComponent(location.origin) + '&return_to=' + encodeURIComponent(location.href);
        if (window.Telegram && Telegram.Login && typeof Telegram.Login.auth === 'function') {
          setStatus('\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u043C \u043E\u043A\u043D\u043E \u0432\u0445\u043E\u0434\u0430 \u0432 Telegram\u2026');
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
<\/script>
</body>
</html>`;
async function proxyToUpstream(request, url) {
  const upstreamUrl = UPSTREAM + (url.pathname === "/" ? "/" : url.pathname) + url.search;
  const res = await fetch(upstreamUrl, { headers: { "accept-encoding": "identity" } });
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("x-robots-tag", "noindex");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
__name(proxyToUpstream, "proxyToUpstream");
function isPublicPath(pathname) {
  if (pathname === "/robots.txt") return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return false;
}
__name(isPublicPath, "isPublicPath");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth") return handleAuth(request, env);
    if (url.pathname === "/api/dbg-initdata") return handleDbgInitData(request, env);
    if (url.pathname === "/api/auth-widget") return handleAuthWidget(request, env);
    if (url.pathname === "/api/activate") return handleActivate(request, env);
    if (isPublicPath(url.pathname)) {
      return proxyToUpstream(request, url);
    }
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
    const session = m ? await verifySessionToken(m[1], env) : null;
    if (session) {
      const res2 = await proxyToUpstream(request, url);
      const ct = res2.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        try {
          let html = await res2.text();
          const userJs = JSON.stringify({
            id: session.uid,
            first_name: session.name || null,
            username: session.uname || null,
            last_name: session.lname || null,
            photo_url: session.photo || null
          });
          const tag = `<script>window.POTOK_USER=${userJs};<\/script>`;
          html = html.includes("</head>") ? html.replace("</head>", tag + "</head>") : tag + html;
          res2.headers.set("cache-control", "no-store");
          return new Response(html, { status: res2.status, headers: res2.headers });
        } catch (e) {
        }
      }
      return res2;
    }
    const res = new Response(GATE_PAGE, { status: 200 });
    res.headers.set("content-type", "text/html; charset=utf-8");
    res.headers.set("cache-control", "no-store");
    res.headers.set("x-robots-tag", "noindex");
    return res;
  }
};

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-O189bj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-O189bj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
