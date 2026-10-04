// «Словарь терминов» — фильтры записей по категориям.
// Категории приходят из бейджей .gl-badge, которые хук hooks/glossary_json.py
// вставляет в markdown страницы glossary.md при сборке.
document$.subscribe(() => {
  const root = document.getElementById("glossary-filters");
  if (!root) return;

  // --- Сбор записей: <p> с бейджем + соседний <blockquote> (ссылки на уроки) ---
  const entries = [];
  root.ownerDocument.querySelectorAll(".md-content .gl-badge").forEach((badge) => {
    const p = badge.closest("p");
    if (!p) return;
    const els = [p];
    let sib = p.nextElementSibling;
    while (sib && sib.tagName === "BLOCKQUOTE") {
      els.push(sib);
      sib = sib.nextElementSibling;
    }
    entries.push({ cat: badge.dataset.cat, els });
  });

  if (!entries.length) {
    root.removeAttribute("data-loading");
    return; // бейджей нет (например, хук не прогнал) — фильтры не показываем
  }

  // Счётчик в hero подстраивается под фактическое число терминов
  const countEl = document.getElementById("gl-count");
  if (countEl) countEl.textContent = String(entries.length);

  // --- Категории: порядок и короткие метки для чипов ---
  const CATS = [
    { id: "theory", label: "Теория" },
    { id: "physics", label: "Физика звука" },
    { id: "mixing", label: "Сведение" },
    { id: "effects", label: "Эффекты" },
    { id: "equipment", label: "Оборудование" },
    { id: "daw", label: "DAW / Продакшн" },
  ];

  const counts = {};
  entries.forEach((e) => { counts[e.cat] = (counts[e.cat] || 0) + 1; });

  // --- Состояние (запоминаем выбор) ---
  let active = localStorage.getItem("potok-glossary-filter") || "all";
  if (active !== "all" && !counts[active]) active = "all";

  // --- Чипы ---
  const bar = document.createElement("div");
  bar.className = "gl-filters";

  function makeChip(id, label, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gl-chip" + (id === active ? " gl-chip-active" : "");
    btn.dataset.cat = id;
    btn.textContent = `${label} · ${count}`;
    btn.addEventListener("click", () => {
      active = id;
      localStorage.setItem("potok-glossary-filter", id);
      bar.querySelectorAll(".gl-chip").forEach((c) => c.classList.toggle("gl-chip-active", c === btn));
      apply();
    });
    return btn;
  }

  bar.appendChild(makeChip("all", "Все", entries.length));
  CATS.forEach((c) => {
    if (counts[c.id]) bar.appendChild(makeChip(c.id, c.label, counts[c.id]));
  });
  root.appendChild(bar);

  // --- Применение фильтра ---
  const entryEls = new Set();
  entries.forEach((e) => e.els.forEach((el) => entryEls.add(el)));

  function apply() {
    entries.forEach((e) => {
      const hide = active !== "all" && e.cat !== active;
      e.els.forEach((el) => { el.hidden = hide; });
    });
    // Пустые буквенные секции прячем вместе с заголовком
    const content = root.parentElement;
    let sectionEls = [];
    function flush() {
      if (!sectionEls.length) return;
      const hasVisible = entries.some(
        (e) => !e.els[0].hidden && sectionEls.includes(e.els[0])
      );
      // Прячем только заголовок и «мусорные» элементы секции;
      // видимостью самих записей управляет цикл выше
      sectionEls.forEach((el) => {
        if (entryEls.has(el)) return;
        el.hidden = !hasVisible;
      });
      sectionEls = [];
    }
    for (const node of content.querySelectorAll("h2")) {
      // только буквенные заголовки A–Z (Material дописывает якорь «#»),
      // «Ссылки на эту страницу» не трогаем
      const letter = node.textContent.replace(/[^A-Za-z]/g, "");
      if (!/^[A-Z]$/.test(letter)) continue;
      flush();
      sectionEls.push(node);
      let sib = node.nextElementSibling;
      while (sib && sib.tagName !== "H2") {
        sectionEls.push(sib);
        sib = sib.nextElementSibling;
      }
    }
    flush();
  }

  apply();
  root.removeAttribute("data-loading");
});
