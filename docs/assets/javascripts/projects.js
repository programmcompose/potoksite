
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
      const state = loadState(projectId);
      const boxes = [...root.querySelectorAll("[data-project-task]")];
      const fill = root.querySelector("[data-project-fill]");
      const count = root.querySelector("[data-project-count]");
      const percent = root.querySelector("[data-project-percent]");
      const reset = root.querySelector("[data-project-reset]");

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
      }

      boxes.forEach(box => {
        box.addEventListener("change", () => {
          state[box.dataset.projectTask] = box.checked;
          saveState(projectId, state);
          render();
        });
      });

      if (reset) {
        reset.addEventListener("click", () => {
          if (!confirm("Сбросить прогресс этого проекта на этом устройстве?")) return;
          localStorage.removeItem(storageKey(projectId));
          Object.keys(state).forEach(k => delete state[k]);
          render();
        });
      }

      render();
    });
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
