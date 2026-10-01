// «Новости Потока» — рендер фида из встроенного JSON (#news-data).
// Блок «Впереди» (будущие посты) + таймлайн/карточки с раскрытием полного текста.
document$.subscribe(() => {
  const root = document.getElementById("news-feed");
  if (!root) return;

  let posts = [];
  try {
    const dataEl = document.getElementById("news-data");
    posts = JSON.parse(dataEl ? dataEl.textContent : "[]") || [];
  } catch (e) {
    posts = [];
  }

  // --- Даты: «сегодня» в МСК (UTC+3), граница публикации — 00:00 МСК ---
  function mskTodayStr() {
    // «Сегодня» в МСК. МСК — фиксированный UTC+3 (без DST с 2014),
    // поэтому просто сдвигаем epoch на +3ч и читаем дату — независимо
    // от часового пояса машины/браузера.
    const mskWall = Date.now() + 3 * 3600000;
    return new Date(mskWall).toISOString().slice(0, 10);
  }

  const todayStr = mskTodayStr();
  const MONTHS = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сен.", "окт.", "нояб.", "дек."];
  const MONTHS_UP = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];

  function fmtDate(iso) {
    const p = iso.split("-").map(Number);
    return `${String(p[2]).padStart(2, "0")} ${MONTHS[p[1] - 1]} ${p[0]} г., 00:00 МСК`;
  }

  function fmtDateShort(iso) {
    const p = iso.split("-").map(Number);
    return `${String(p[2]).padStart(2, "0")} ${MONTHS[p[1] - 1]} ${p[0]} г.`;
  }

  function daysUntil(iso) {
    const a = Date.parse(todayStr + "T00:00:00Z");
    const b = Date.parse(iso + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  }

  function countdownLabel(n) {
    if (n <= 0) return "сегодня";
    if (n === 1) return "завтра";
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} день`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
    return `${n} дн.`;
  }

  // --- Состояние ---
  const state = {
    view: localStorage.getItem("potok-news-view") === "cards" ? "cards" : "timeline",
    type: "all",
  };

  const TYPES = [
    { id: "all", label: "Все" },
    { id: "этап", label: "Этапы" },
    { id: "ивент", label: "Ивенты" },
    { id: "инфо", label: "Инфо" },
  ];

  // --- DOM-хелперы (title/teaser — только как текст, body_html — доверенный) ---
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function badge(type) {
    return el("span", `nf-badge nf-badge-${type}`, type.toUpperCase());
  }

  function media(post, cls) {
    const wrap = el("div", cls);
    if (post.image) {
      const img = document.createElement("img");
      img.src = post.image;
      img.alt = "";
      img.loading = "lazy";
      wrap.appendChild(img);
    } else {
      wrap.classList.add("nf-media-empty");
      wrap.appendChild(el("span", "nf-media-ph", "ПОТОК"));
    }
    return wrap;
  }

  function expandControl(post) {
    const btn = el("button", "nf-expand", "ЧИТАТЬ ПОЛНОСТЬЮ ↓");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    const body = el("div", "nf-body");
    body.hidden = true;
    if (post.body_html) body.innerHTML = post.body_html; // доверенный контент владельца
    btn.addEventListener("click", () => {
      const open = !body.hidden;
      body.hidden = open;
      btn.setAttribute("aria-expanded", String(!open));
      btn.textContent = open ? "ЧИТАТЬ ПОЛНОСТЬЮ ↓" : "СВЕРНУТЬ ↑";
    });
    return [btn, body];
  }

  // --- Блок «Впереди» ---
  function renderUpcoming(container) {
    const upcoming = posts.filter((p) => p.date > todayStr);
    if (!upcoming.length) return;

    container.appendChild(el("div", "nf-kicker", "КАЛЕНДАРЬ СОБЫТИЙ"));
    const head = el("div", "nf-up-head");
    head.appendChild(el("h2", "nf-up-title", "Впереди"));
    head.appendChild(el("span", "nf-count", String(upcoming.length).padStart(2, "0")));
    container.appendChild(head);

    const list = el("ul", "nf-up-list");
    upcoming.forEach((p) => {
      const li = el("li", "nf-up-item");
      const d = p.date.split("-").map(Number);
      const dateBox = el("div", "nf-up-date");
      dateBox.appendChild(el("span", "nf-up-day", String(d[2]).padStart(2, "0")));
      dateBox.appendChild(el("span", "nf-up-month", MONTHS_UP[d[1] - 1]));
      li.appendChild(dateBox);

      const body = el("div", "nf-up-body");
      const line1 = el("div", "nf-up-line1");
      line1.appendChild(badge(p.type));
      line1.appendChild(el("strong", "nf-up-title-text", p.title));
      body.appendChild(line1);
      if (p.teaser) body.appendChild(el("span", "nf-up-teaser", p.teaser));
      li.appendChild(body);

      const n = daysUntil(p.date);
      li.appendChild(el("span", "nf-countdown", countdownLabel(n)));
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  // --- Посты: таймлайн и карточки ---
  function publishedPosts() {
    return posts.filter((p) => p.date <= todayStr && (state.type === "all" || p.type === state.type));
  }

  function timelineItem(post, idx) {
    const art = el("article", "nf-item");
    art.dataset.type = post.type;
    art.appendChild(el("span", "nf-num", String(idx + 1).padStart(2, "0")));
    art.appendChild(media(post, "nf-media"));

    const content = el("div", "nf-content");
    const meta = el("div", "nf-meta");
    const time = document.createElement("time");
    time.dateTime = post.date;
    time.textContent = fmtDate(post.date);
    meta.appendChild(time);
    meta.appendChild(badge(post.type));
    content.appendChild(meta);

    content.appendChild(el("h3", "nf-title", post.title));
    if (post.teaser) content.appendChild(el("p", "nf-teaser", post.teaser));
    const [btn, body] = expandControl(post);
    content.appendChild(btn);
    content.appendChild(body);
    art.appendChild(content);
    return art;
  }

  function cardItem(post) {
    const art = el("article", "nf-card");
    art.dataset.type = post.type;

    const mWrap = media(post, "nf-card-media");
    if (post.image) mWrap.appendChild(badge(post.type));
    art.appendChild(mWrap);

    const body = el("div", "nf-card-body");
    const time = document.createElement("time");
    time.dateTime = post.date;
    time.textContent = fmtDateShort(post.date);
    if (!post.image) {
      const metaLine = el("div", "nf-meta");
      metaLine.appendChild(time);
      metaLine.appendChild(badge(post.type));
      body.appendChild(metaLine);
    } else {
      body.appendChild(time);
    }
    body.appendChild(el("h3", "nf-title", post.title));
    if (post.teaser) body.appendChild(el("p", "nf-teaser", post.teaser));
    const [btn, bod] = expandControl(post);
    body.appendChild(btn);
    body.appendChild(bod);
    art.appendChild(body);
    return art;
  }

  function emptyState(container, text) {
    container.appendChild(el("div", "nf-empty", text));
  }

  // --- Тулбар: фильтры + переключатель вида ---
  const toolbar = el("div", "nf-toolbar");
  const feedHead = el("div", "nf-feed-head");
  feedHead.appendChild(el("h2", "nf-feed-title", "Лента"));
  toolbar.appendChild(feedHead);

  const filters = el("div", "nf-filters");
  TYPES.forEach((t) => {
    const chip = el("button", "nf-chip" + (state.type === t.id ? " nf-chip-active" : ""), t.label);
    chip.type = "button";
    chip.dataset.type = t.id;
    chip.addEventListener("click", () => {
      state.type = t.id;
      filters.querySelectorAll(".nf-chip").forEach((c) => c.classList.toggle("nf-chip-active", c === chip));
      renderFeed();
    });
    filters.appendChild(chip);
  });
  toolbar.appendChild(filters);

  const views = el("div", "nf-views");
  [
    { id: "timeline", label: "Таймлайн" },
    { id: "cards", label: "Карточки" },
  ].forEach((v) => {
    const btn = el("button", "nf-view-btn" + (state.view === v.id ? " nf-view-active" : ""), v.label);
    btn.type = "button";
    btn.dataset.view = v.id;
    btn.addEventListener("click", () => {
      state.view = v.id;
      localStorage.setItem("potok-news-view", v.id);
      views.querySelectorAll(".nf-view-btn").forEach((b) => b.classList.toggle("nf-view-active", b === btn));
      timelineWrap.hidden = v.id !== "timeline";
      cardsWrap.hidden = v.id !== "cards";
      renderFeed();
    });
    views.appendChild(btn);
  });
  toolbar.appendChild(views);

  const timelineWrap = el("div", "nf-timeline");
  const cardsWrap = el("div", "nf-cards");
  cardsWrap.hidden = state.view !== "cards";
  timelineWrap.hidden = state.view === "cards";

  function renderFeed() {
    timelineWrap.innerHTML = "";
    cardsWrap.innerHTML = "";
    const list = publishedPosts();
    if (!list.length) {
      emptyState(timelineWrap, posts.length ? "Пока тихо — по этому фильтру постов нет." : "Пока тихо... Следите за блоком «Впереди».");
      emptyState(cardsWrap, "Пока тихо...");
      return;
    }
    list.forEach((p, i) => timelineWrap.appendChild(timelineItem(p, i)));
    list.forEach((p) => cardsWrap.appendChild(cardItem(p)));
  }

  // --- Сборка страницы ---
  const upcomingBox = el("section", "nf-upcoming");
  renderUpcoming(upcomingBox);
  root.appendChild(upcomingBox);
  root.appendChild(toolbar);
  root.appendChild(timelineWrap);
  root.appendChild(cardsWrap);
  renderFeed();
  root.removeAttribute("data-loading");
});
