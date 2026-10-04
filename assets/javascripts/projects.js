
(function () {
  const STORAGE_PREFIX = "potok:project:";

  function storageKey(projectId) {
    return STORAGE_PREFIX + projectId;
  }

  function loadState(projectId) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(projectId)) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveState(projectId, state) {
    localStorage.setItem(storageKey(projectId), JSON.stringify(state));
  }

  function initProjects() {
    document.querySelectorAll("[data-potok-project]").forEach(root => {
      if (root.dataset.potokInitialized === "1") return;
      root.dataset.potokInitialized = "1";

      const projectId = root.dataset.potokProject;
      // Маркер data-potok-project стоит на hero-блоке, а чекбоксы «Задание»
      // и кнопка сброса находятся ниже по странице — ищем их во всём контенте.
      const scope = document.querySelector(".md-content") || document;
      const state = loadState(projectId);
      const boxes = [...scope.querySelectorAll("[data-project-task]")];
      const fill = root.querySelector("[data-project-fill]");
      const count = root.querySelector("[data-project-count]");
      const percent = root.querySelector("[data-project-percent]");
      const reset = scope.querySelector("[data-project-reset]");

      function render() {
        let done = 0;
        boxes.forEach(box => {
          const id = box.dataset.projectTask;
          box.checked = state[id] === true;
          const row = box.closest(".potok-project-task");
          if (row) row.classList.toggle("is-done", box.checked);
          if (box.checked) done++;
        });
        const total = boxes.length;
        const pct = total ? Math.round(done / total * 100) : 0;
        if (fill) fill.style.width = pct + "%";
        if (count) count.textContent = `${done} из ${total}`;
        if (percent) percent.textContent = pct + "%";
        root.classList.toggle("is-complete", total > 0 && done === total);
        return { done, total };
      }

      // Празднуем только в момент перехода «не всё → всё»,
      // а не при каждой загрузке уже завершённого проекта.
      let complete = false;

      boxes.forEach(box => {
        box.addEventListener("change", () => {
          const wasComplete = complete;
          state[box.dataset.projectTask] = box.checked;
          saveState(projectId, state);
          const stats = render();
          complete = stats.total > 0 && stats.done === stats.total;
          if (complete && !wasComplete) celebrate(root, stats);
        });
      });

      if (reset) {
        reset.addEventListener("click", () => {
          if (!confirm("Сбросить прогресс этого проекта на этом устройстве?")) return;
          localStorage.removeItem(storageKey(projectId));
          Object.keys(state).forEach(k => delete state[k]);
          const afterReset = render();
          complete = afterReset.total > 0 && afterReset.done === afterReset.total;
        });
      }

      const initial = render();
      complete = initial.total > 0 && initial.done === initial.total;
    });
  }

  // === Празднование завершения проекта: звук + конфетти + сообщение ===

  let fanfareCtx = null;

  function playFanfare() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!fanfareCtx) fanfareCtx = new Ctx();
      if (fanfareCtx.state === "suspended") fanfareCtx.resume();
      const t0 = fanfareCtx.currentTime + 0.03;
      const master = fanfareCtx.createGain();
      master.gain.value = 0.22;
      master.connect(fanfareCtx.destination);
      function note(freq, start, dur, type, vol) {
        const osc = fanfareCtx.createOscillator();
        const g = fanfareCtx.createGain();
        osc.type = type || "triangle";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + start);
        g.gain.linearRampToValueAtTime(vol || 1, t0 + start + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.05);
      }
      // Восходящее арпеджио C5-E5-G5-C6 + финальный аккорд с «бликом»
      note(523.25, 0.0, 0.5);            // C5
      note(659.25, 0.14, 0.5);           // E5
      note(783.99, 0.28, 0.6);           // G5
      note(1046.5, 0.42, 1.1, "triangle", 0.9);  // C6 — удержание
      note(1318.5, 0.42, 1.0, "sine", 0.35);     // E6 — мягкий аккорд
      note(2093.0, 0.62, 0.8, "sine", 0.15);     // C7 — искра сверху
    } catch (_) { /* звук не критичен */ }
  }

  function launchConfetti() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let canvas = document.getElementById("potok-confetti-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "potok-confetti-canvas";
        canvas.className = "potok-confetti";
        (document.body || document.documentElement).appendChild(canvas);
      }
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ["#00e5ff", "#ffd740", "#ff6ec7", "#7cffcb", "#ffffff"];
      const parts = [];
      function spawn(x, y, vx, vy) {
        parts.push({
          x, y, vx, vy,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          color: colors[(Math.random() * colors.length) | 0],
          life: 180 + (Math.random() * 60) | 0,
          shape: Math.random() < 0.7 ? "rect" : "circle"
        });
      }
      // Два «пушка» из нижних углов + лёгкий дождь сверху
      for (let i = 0; i < 90; i++) spawn(-20, h * 0.85, 4 + Math.random() * 7, -(9 + Math.random() * 6));
      for (let i = 0; i < 90; i++) spawn(w + 20, h * 0.85, -(4 + Math.random() * 7), -(9 + Math.random() * 6));
      for (let i = 0; i < 60; i++) spawn(Math.random() * w, -20 - Math.random() * h * 0.3, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 3);
      let frame = 0;
      function tick() {
        ctx.clearRect(0, 0, w, h);
        for (const p of parts) {
          p.vy += 0.16; p.vx *= 0.992;
          p.x += p.vx; p.y += p.vy;
          p.rot += p.vr; p.life--;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.shape === "rect") ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.6);
          else { ctx.beginPath(); ctx.arc(0, 0, p.w / 3, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          if (parts[i].life <= 0 || parts[i].y > h + 40) parts.splice(i, 1);
        }
        frame++;
        if (parts.length && frame < 600) requestAnimationFrame(tick);
        else { ctx.clearRect(0, 0, w, h); canvas.remove(); }
      }
      requestAnimationFrame(tick);
    } catch (_) { /* конфетти не критично */ }
  }

  function showCelebrationOverlay(root, stats) {
    const h1 = root.querySelector("h1");
    const title = h1 ? h1.textContent.trim() : "";
    const overlay = document.createElement("div");
    overlay.className = "potok-celebrate-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="potok-celebrate-card">' +
        '<div class="potok-celebrate-emoji" aria-hidden="true">🎉</div>' +
        '<h2 class="potok-celebrate-title">Ты преодолел ещё один важный этап в своей музыкальной карьере!</h2>' +
        '<p class="potok-celebrate-sub">Ты красавчик!' + (title ? ` Проект «${title}» — ${stats.done} из ${stats.total}.` : "") + '</p>' +
        '<button type="button" class="potok-celebrate-close">Продолжить</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlay.classList.remove("is-visible");
      setTimeout(() => overlay.remove(), 350);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    const btn = overlay.querySelector(".potok-celebrate-close");
    if (btn) btn.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    setTimeout(close, 9000); // автозакрытие, если не трогать
  }

  function celebrate(root, stats) {
    playFanfare();
    launchConfetti();
    showCelebrationOverlay(root, stats);
  }

  // Material for MkDocs navigation.instant support.
  if (typeof document$ !== "undefined") {
    document$.subscribe(initProjects);
  } else {
    document.addEventListener("DOMContentLoaded", initProjects);
  }

  // Expose a tiny API for future integrations, without requiring accounts.
  window.PotokProjects = {
    get(projectId) { return loadState(projectId); },
    reset(projectId) { localStorage.removeItem(storageKey(projectId)); },
    key: storageKey
  };
})();
