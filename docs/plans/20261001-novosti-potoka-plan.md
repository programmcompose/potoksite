# Plan: «НОВОСТИ ПОТОКА» — секция новостей/событий

> Status: executing

## Problem summary

На MkDocs-сайте potoksite нет места для актуальных новостей: выход этапов, ивенты, важные объявления. Нужен отдельный топик «НОВОСТИ ПОТОКА»: фид постов (таймлайн + карточки), блок «Впереди» с будущими событиями, автопоявление постов по дате из frontmatter без пересборки, добавление поста = один .md-файл. Полные требования: `docs/brainstorms/20261001-novosti-potoka-requirements.md`.

## Relevant learnings

`docs/solutions/` отсутствует — релевантных прошлых артефактов нет. Из репозитория: проект уже использует MkDocs hooks (`hooks/glossary_json.py`, `hooks/link_graph.py`) — тот же механизм используем для сбора данных постов.

## Scope boundaries

**In:** новый пункт nav, страница фида `docs/news/index.md`, хук `hooks/news_feed.py`, JS-рендерер, CSS под палитру сайта, 3 демо-поста + README формата поста, exclude_docs для исходников постов.
**Out:** React-сайт pepel4two.ru; бэкенд/админка/формы; отдельные URL на посты; сетка месяца календаря; индексация постов в поиске Material (принятый trade-off); изменения остальных секций.

## Architecture decisions

No ADR-worthy decisions. Ключевые решения уже зафиксированы в brainstorm: вариант A (одна страница фида + хук, встраивающий JSON; клиентское раскрытие по дате). Механика: хук на `on_page_context` кладёт JSON всех постов (включая будущие) в контекст только страницы `news/index.md`; markdown-страница содержит `<script type="application/json" id="news-data">{{ news_feed_json }}</script>`; JS фильтрует по дате (граница 00:00 МСК, UTC+3) и рендерит. Тело поста конвертируется в HTML хуком через python-markdown (зависимость уже есть).

## Implementation units

### U1. Хук сбора постов `hooks/news_feed.py` (TDD)

**Goal:** функция `collect_posts(docs_dir)` парсит `docs/news/posts/*.md` (frontmatter: title, date, type, image, teaser + тело → HTML), возвращает отсортированный список; хук на `on_page_context` вставляет JSON в контекст страницы news.
**Files:** create `hooks/news_feed.py`, create `tests/test_news_feed.py`; modify `mkdocs.yml` (hooks: + строка).
**Patterns to follow:** `hooks/glossary_json.py` (чтение файлов вручную, без зависимости от file list); frontmatter парсить через `yaml` (PyYAML уже в Lib/site-packages) — проверить перед реализацией.
**Test scenarios:**
- happy: 2 поста с разными датами → сортировка по дате убыванию; поля title/date/type/teaser/image/body_html на месте; body — HTML, а не markdown.
- edge: пост без image → поле null/пусто; type отсутствует → «инфо»; date в будущем → тоже включается (фильтр клиентский).
- error: нет title или date → файл пропускается с warning, сборка не падает; кривой формат даты → пропуск + warning.
**Verification:** `C:/Python313_old/python.exe tests/test_news_feed.py` — все assert проходят (RED до реализации: ImportError).
**Dependencies:** нет.

### U2. Страница фида, nav, exclude_docs

**Goal:** страница «НОВОСТИ ПОТОКА» в навигации с контейнером фида и встроенным JSON; исходники постов не публикуются отдельными страницами.
**Files:** create `docs/news/index.md`; modify `mkdocs.yml` (nav: пункт после «Главная», иконка `newspaper`; exclude_docs: + `news/posts/**`).
**Patterns to follow:** hero-заголовки других секций (см. `docs/fishki-prodyusera.md`, `docs/faq.md`) — бейдж над заголовком, стиль «СОЗДАВАЙ / ДЕЛИСЬ / ЗВУЧИ».
**Test scenarios:** build проходит; в `site/news/index.html` есть `#news-feed`, `<script id="news-data">` с JSON (3 демо-поста), пункт nav ссылается на `/news/`; посты НЕ имеют своих страниц в site/.
**Verification:** `mkdocs build --clean && grep -c "news-data" site/news/index.html` (=1) + `test ! -d site/news/posts`.
**Dependencies:** U1 (JSON должен быть), U5-контент для проверки (демо-посты).

### U3. JS-рендерер фида `docs/assets/javascripts/news-feed.js`

**Goal:** рендер из JSON: блок «Впереди» (будущие посты: дата, заголовок, тип, «N дн.»), переключатель Таймлайн/Карточки (localStorage), фильтр по типу (чипы), таймлайн с нумерацией 01… и картинкой слева, карточки сеткой; раскрытие полного текста вниз («ЧИТАТЬ ПОЛНОСТЬЮ ↓»); пустое состояние «Пока тихо...».
**Files:** create `docs/assets/javascripts/news-feed.js`; modify `mkdocs.yml` (extra_javascript: + строка).
**Patterns to follow:** `assets/javascripts/scroll-cards.js`, `article-reveal.js` (IIFE, guard на отсутствие контейнера — скрипт глобальный и должен молча работать на других страницах); даты форматировать как «01 окт. 2026 г., 00:00 МСК» (как на референсе).
**Test scenarios:**
- будущий пост → только в «Впереди», не в таймлайне; прошедший → в таймлайне с нумерацией.
- переключатель вида меняет разметку и запоминается; фильтр по типу скрывает чужие типы, «Все» возвращает.
- раскрытие: клик по «ЧИТАТЬ ПОЛНОСТЬЮ ↓» показывает body_html, повторный клик сворачивает; заголовок/тизер вставляются как текст (DOM API), не innerHTML.
- пустой JSON → заглушка «Пока тихо...»; страница без #news-feed → скрипт ничего не делает.
**Verification:** `node --check docs/assets/javascripts/news-feed.js` (синтаксис) + build + ручная проверка в dev-сервере (`mkdocs serve`, открыть /news/): все сценарии выше; таймлайн и карточки, мобильная ширина.
**Dependencies:** U2 (контейнер + JSON).

### U4. Стили `docs/assets/stylesheets/news-feed.css`

**Goal:** вёрстка фида под палитру сайта: линия таймлайна с номерами-ромбами (как референс), карточки, бейджи типов (оранжевый акцент), блок «Впереди», анимация раскрытия, responsive (1 колонка на мобильном), дублирование для светлой/тёмной темы через существующие design tokens.
**Files:** create `docs/assets/stylesheets/news-feed.css`; modify `mkdocs.yml` (extra_css: + строка).
**Patterns to follow:** `assets/stylesheets/challenge.css`, `gamification.css` (tokens `--accent-orange`, `--bg-card`, `--text-main`; секции `[data-md-color-scheme="slate"]`/`default`). Иконки только Lucide, цвет иконок `--accent-orange`.
**Test scenarios:** тёмная тема — контраст читаемый; светлая — дубли стилией работают; мобильный (375px) — одна колонка, таймлайн не ломается; раскрытый пост не «прыгает» вёрстку.
**Verification:** build + визуальная проверка в dev-сервере (тёмная/светлая темы, desktop/mobile).
**Dependencies:** U3 (классы разметки).

### U5. Демо-контент и README формата поста

**Goal:** 3 демо-поста + обложки + короткий README для владельца (формат frontmatter, как добавлять пост голосом/файлом).
**Files:** create `docs/news/posts/dobro-pozhalovat.md` (date = день запуска, type: инфо), `docs/news/posts/demo-etap.md` (прошедшая дата, type: этап), `docs/news/posts/demo-ivent.md` (дата +7 дней от запуска, type: ивент — демонстрирует «Впереди» и автопоявление); create обложки `docs/assets/news/*.svg` (тёмный фон + крупная типографика в стиле референса); create `docs/news/posts/README.md`.
**Patterns to follow:** тексты — тон сайта («Поток», ученикам курса); README — формат из brainstorm.
**Test scenarios:** все 3 поста проходят валидацию хука; обложки отображаются (svg через <img>); README не публикуется на сайт (exclude_docs).
**Verification:** `mkdocs build --clean && grep -o "demo-ivent\|dobro-pozhalovat" site/news/index.html | sort -u` (оба в JSON) + `test ! -f site/news/posts/README.md`.
**Dependencies:** U1.

## Verification strategy

1. **Целевая:** тесты U1 (`python tests/test_news_feed.py`), build-ассерты U2/U5, `node --check` U3, визуал U4 — см. в юнитах.
2. **Общая:** полный `mkdocs build --clean` без ошибок/warnings по новым файлам; прогонка остальных страниц (nav не сломан, extra_javascript не роняет другие страницы — открыть главную и любой этап).
3. **Приёмка по success criteria из brainstorm** (пункты 1–5): автопоявление проверить подменой даты демо-поста на завтра → сегодня (пост в «Впереди»), затем на сегодня → пост в таймлайне без пересборки (обновить страницу).
4. **Git:** после каждого завершённого юнита — `git add . && git commit "x" && git push` (правило AGENTS.md проекта).
