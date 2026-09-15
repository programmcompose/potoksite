document$.subscribe(() => {
  const header = document.querySelector(".md-header__inner");
  if (!header || document.getElementById("graph-toggle-btn")) return;

  const btn = document.createElement("button");
  btn.id = "graph-toggle-btn";
  btn.className = "md-header__button md-icon";
  btn.setAttribute("aria-label", "Граф связей");
  btn.title = "Граф связей";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>`;
  header.appendChild(btn);

  const modal = document.createElement("div");
  modal.id = "graph-modal";
  modal.className = "graph-modal";
  modal.innerHTML = `
    <div class="graph-modal__inner">
      <div class="graph-modal__header">
        <h3>🕸️ Граф связей</h3>
        <button class="graph-modal__close" aria-label="Закрыть">&times;</button>
      </div>
      <div class="graph-modal__body" id="graph-container"></div>
    </div>
    <div class="graph-modal__overlay"></div>
  `;
  document.body.appendChild(modal);

  const openModal = () => {
    const original = document.querySelector(".network-graph");
    if (original) {
      document.getElementById("graph-container").appendChild(original);
      modal.classList.add("active");
    }
  };
  const closeModal = () => {
    const container = document.getElementById("graph-container");
    const original = document.querySelector(".network-graph");
    if (original && !original.closest("article")) {
      const page = document.querySelector("article") || document.body;
      page.appendChild(original);
    }
    modal.classList.remove("active");
  };

  btn.addEventListener("click", openModal);
  modal.querySelector(".graph-modal__close").addEventListener("click", closeModal);
  modal.querySelector(".graph-modal__overlay").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());
});
