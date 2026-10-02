/* ============================================
   Reading Progress Bar
   Файл: docs/assets/javascripts/reading-progress.js
   ============================================ */

(function () {
  "use strict";

  function initReadingProgress() {
    // Не создаём второй раз при instant navigation
    if (document.querySelector(".reading-progress")) return;

    const bar = document.createElement("div");
    bar.className = "reading-progress";
    document.body.prepend(bar);

    function updateProgress() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;

      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });

    // Обновляем сразу
    updateProgress();
  }

  // Обычная загрузка
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReadingProgress);
  } else {
    initReadingProgress();
  }

  // Поддержка navigation.instant (Material)
  // Material перезагружает контент, но document остаётся
  document.addEventListener("DOMContentSwitch", initReadingProgress);
})();
