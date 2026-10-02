var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var UPSTREAM = "https://programmcompose.github.io/potoksite";
var COURSE_CHAT_ID = "-1003906004104";
var SESSION_TTL_DAYS = 7;
var COOKIE_NAME = "potok_session";
var enc = new TextEncoder();
async function hmacSign(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, typeof message === "string" ? enc.encode(message) : message);
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
  const payload = b64url(enc.encode(JSON.stringify({ uid: user.id, name: user.first_name || "", exp })));
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
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = await hmacSign(enc.encode(env.BOT_TOKEN), "WebAppData");
  const calculated = toHex(await hmacSign(secretKey, lines));
  if (calculated.length !== hash.length || calculated !== hash) return null;
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (!authDate || Math.floor(Date.now() / 1e3) - authDate > 86400) return null;
  try {
    const user = JSON.parse(params.get("user"));
    if (!user || !user.id) return null;
    return user;
  } catch {
    return null;
  }
}
__name(validateInitData, "validateInitData");
async function isCourseMember(userId, env) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: COURSE_CHAT_ID, user_id: userId })
  });
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
  const user = await validateInitData(body.initData || "", env);
  if (!user) return json({ ok: false, error: "init_data_invalid" }, 401);
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
  <button class="btn secondary" id="copyBtn" style="display:none">\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430</button>
  <div id="browserBox" style="display:none">
    <p>\u041E\u0442\u043A\u0440\u043E\u0439 \u044D\u0442\u0443 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0432 Telegram, \u0432\u043E\u0439\u0434\u0438 \u0442\u0430\u043C, \u043D\u0430\u0436\u043C\u0438 \xAB\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430\xBB \u0438 \u0432\u0441\u0442\u0430\u0432\u044C \u0435\u0451 \u0441\u044E\u0434\u0430 (\u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0442\u043E \u043E\u0442\u043A\u0440\u043E\u0439 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443):</p>
    <input id="paste" placeholder="https://potoksite.compose-ivan.workers.dev/api/activate?t=...">
  </div>
  <div class="status" id="status"></div>
</div>
<script>
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  var statusEl = document.getElementById('status');

  function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status ' + (cls || ''); }

  if (tg && tg.initData) {
    // === \u0412\u043D\u0443\u0442\u0440\u0438 Telegram: \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0432\u0445\u043E\u0434 ===
    document.getElementById('hint').textContent = '\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C, \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u043B\u0438 \u0442\u044B \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430\u2026';
    setStatus('');
    fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.d.ok) throw new Error(x.d.error || 'auth failed');
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
        var msg = e.message === 'not_member'
          ? '\u0422\u044B \u043D\u0435 \u0441\u043E\u0441\u0442\u043E\u0438\u0448\u044C \u0432 \u0447\u0430\u0442\u0435 \u043A\u0443\u0440\u0441\u0430. \u0412\u0441\u0442\u0443\u043F\u0438 \u0432 \u0447\u0430\u0442 \xAB\u041F\u043E\u0442\u043E\u043A\xBB \u0438 \u043E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443.'
          : '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0439\u0442\u0438 (' + e.message + '). \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443.';
        setStatus(msg, 'err');
      });
  } else {
    // === \u041E\u0431\u044B\u0447\u043D\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 ===
    document.getElementById('browserBox').style.display = 'block';
    var paste = document.getElementById('paste');
    paste.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && paste.value.trim()) location.href = paste.value.trim();
    });
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
    if (url.pathname === "/api/activate") return handleActivate(request, env);
    if (isPublicPath(url.pathname)) {
      return proxyToUpstream(request, url);
    }
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
    const session = m ? await verifySessionToken(m[1], env) : null;
    if (session) {
      return proxyToUpstream(request, url);
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

// .wrangler/tmp/bundle-uNw99x/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-uNw99x/middleware-loader.entry.ts
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
