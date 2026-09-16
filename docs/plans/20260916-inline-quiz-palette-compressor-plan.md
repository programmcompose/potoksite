# План: Инлайн-квизы, Командная палитра, Интерактивный компрессор

> **Дата:** 2026-09-16
> **Требования:** договорённости в чате от 2026-09-16 (3 фичи из brainstorm по развитию сайта)
> **Язык:** Python (build-hooks), JavaScript (HTML/CSS, Web Audio API)
> **Статус:** ✅ Готов к реализации
> **Handoff:** → 03-work

**Ключевые решения (утверждены):**
1. Данные квизов — **JSON как единый источник** (`docs/assets/data/quiz/{stage}.json`), quiz-страница грузит их через сгенерированный bundle (сохраняет работу по `file://`).
2. Компрессор — **реальный звук**: синтез бита в JS + настоящий алгоритм компрессора + A/B bypass.

---

## Обзор

Три независимые фичи, которые можно реализовывать параллельно:

| Фича | Суть | Польза |
|---|---|---|
| **F1. Инлайн-квизы** | Fence ` ```quiz stage="etap2" count=5 ` в уроках; вопросы из единого JSON; XP/бейджи через `window.PotokGamification` | Тест внутри урока, а не переход на отдельную страницу; прогресс капает в геймификацию |
| **F2. Командная палитра** | Ctrl+K → поиск по страницам (через `search_index.json`) + команды («Этап 3», «Тёмная тема», «Wavetable») | Быстрая навигация по большому курсу, единая точка входа в инструменты |
| **F3. Интерактивный компрессор** | Виджет с синтезированным битом, DSP-компрессором (soft knee), GR-метром и transfer curve; A/B bypass | Страница Compression становится «слышимой» — ядро этапа 2 |

**Общие ограничения:**
- GitHub Pages: только клиентский JS + статические файлы. Никаких новых CDN-зависимостей (чистый JS, canvas, Web Audio).
- House rules из AGENTS.md: иконки только Lucide в `--accent-orange`, design tokens (`--bg-card`, `--border-default`…), дублирование стилей для `[data-md-color-scheme="slate"]` и `"default"`, уважение к `prefers-reduced-motion`.
- Инструменты в `docs/tools/` должны продолжать работать по `file://` (fetch там не работает) — отсюда bundle-подход в F1.

---

## Архитектура

### F1: Инлайн-квизы

```
docs/assets/data/quiz/            # НОВОЕ — единый источник вопросов
├── etap0.json … etap9.json       # {id, short, title, desc, questions:[{cat,q,options[],correct,comment}]}
docs/tools/quiz/
├── index.html                    # РЕФАКТОР: встроенный STAGES (~4500 строк) → <script src="stages-bundle.js">
└── stages-bundle.js              # ГЕНЕРИРУЕТСЯ build-hook'ом (не коммитится): window.POTOK_QUIZ_STAGES=[…]
docs/assets/javascripts/inline-quiz.js   # НОВОЕ — виджет инлайн-квиза
hooks/quiz_bundle.py              # НОВОЕ — собирает JSON → site/tools/quiz/stages-bundle.js
hooks/quiz_fence.py               # НОВОЕ — форматтер superfences: ```quiz …``` → <div class="potok-quiz-inline">
Scripts/extract_quiz_data.py      # НОВОЕ — разовая миграция: STAGES из index.html → JSON-файлы
docs/assets/javascripts/gamification.js  # ИЗМЕНЕНИЕ: новые поля stats + бейджи + правила XP
```

**Поток данных:** JSON (источник) → build-hook → `stages-bundle.js` для quiz-страницы (file://-совместимо) и те же JSON копируются в `site/assets/data/quiz/` для виджета (fetch на GH Pages, как у glossary.json).

**Правила XP (анти-фарм):**
- Ключ рекорда — тот же `potok-quiz-best-{stage}`, что и у standalone quiz (формат `{score,total,date}`) → прогресс общий.
- Завершил квиз: если score **лучше** сохранённого рекорда → `addXP(10 × score, 'quiz_{stage}')` + запись рекорда. Повтор без нового рекорда — XP не начисляется.
- Новые поля stats (читать через `(stats.x||0)`, как уже сделано): `quizzesDone`, `quizCorrect`, `perfectQuizzes`.
- Новые бейджи: `quiz_first` («Первый тест», quizzesDone≥1), `quiz_perfect` («Без ошибок», perfectQuizzes≥1), `quiz_master` («Мастер тестов», quizzesDone≥5).

**Выбор вопросов:** `count=N` → случайная выборка, seed = дата+stage (стабильна в течение дня); опционально `cats="EQ,Компрессия"` — фильтр по категориям.

### F2: Командная палитра

```
docs/assets/javascripts/search-ctrlk.js   # ПЕРЕПИСАТЬ: Ctrl+K → палитра (оверлей + fuzzy)
docs/assets/stylesheets/extra.css         # стили палитры (оба режима темы)
```

**Источники данных:**
- Страницы: `fetch('/potoksite/search/search_index.json')` — уже генерируется плагином search (title, text, url, location). Ленивая загрузка при первом открытии + кэш в памяти.
- Команды: статический массив в JS — темы (тёмная/светлая), инструменты (`tools/wavetable`, `eq-trainer`, `browser-daw`, `quiz`, `frequency-map`, `harmony-map`, `waveforms`…), этапы 0–9, ключевые страницы (Словарь, FAQ, Бейджи, Статистика, Маршрут).
- Переключение темы: клик по кнопке палитры в `.md-header__options`; fallback — смена `html[data-md-color-scheme]` + запись в localStorage-ключ Material (`md`).

**UX:** оверлей сверху (~15vh), инпут + результаты группами «Команды» / «Страницы», ↑↓/Enter/Esc, hover-выделение, подсветка совпадений, последние 5 использованных (localStorage `potok-palette-recent`), fuzzy = subsequence scoring без зависимостей.

### F3: Интерактивный компрессор

```
docs/assets/javascripts/compressor-widget.js   # НОВОЕ — движок + UI (единый модуль)
docs/assets/stylesheets/compressor.css         # НОВОЕ — стили виджета (оба режима темы)
docs/tools/compressor/index.html               # НОВОЕ — standalone-страница инструмента (тонкая обёртка)
docs/etap2/compression-kompressiya.md          # ИЗМЕНЕНИЕ: <div class="potok-compressor"></div> после «Параметры компрессора»
```

**Аудио-движок (Web Audio, без файлов):**
- Синтез 2 тактов лупа @90 BPM в AudioBuffer: kick (sine sweep 150→50 Гц + клик), snare (noise burst + тело ~200 Гц), closed hihat (короткий highpass-noise). Паттерн — как в уроке «Драмка и построение бита».
- Компрессор: sample-accurate JS — envelope follower (attack/release time constants), soft-knee transfer curve, threshold/ratio/makeup. Обработка лупа оффлайн → второй AudioBuffer; при смене параметров — пере-рендер (~0.5 с на 2 такта, debounce 150 мс).
- A/B: play/stop + большая bypass-кнопка (переключение буферов без щелчков — кроссфейд 10 мс).

**Визуализация (canvas):**
- Волны input/output наложением (input — серый, output — `--accent-orange`).
- GR-метр: вертикальный VU-бар текущего gain reduction в дБ.
- Transfer curve (вход/выход в дБ) с живым маркером рабочей точки — главный обучающий визуал.

**Пресеты (из таблицы «Применение» на странице):** «Мелодия 2:1 slow attack», «Snare punch fast attack», «Bus 1.5:1».

---

## Implementation Units

### F1 · Unit 1: Миграция данных квиза в JSON

**Цель:** Единый источник вопросов — `docs/assets/data/quiz/{stage}.json` для всех 10 этапов.

**Файлы:**
- `Scripts/extract_quiz_data.py` (создать)
- `docs/assets/data/quiz/etap0.json … etap9.json` (создать, 10 файлов)

**Задачи:**
- [ ] Скрипт: вырезать текст массива STAGES из `docs/tools/quiz/index.html` (от `const STAGES = [` до закрывающего `];`)
- [ ] Конвертер JS-object-literal → JSON: кавычки вокруг ключей, одинарные→двойные, хвостовые запятые. Данные машиночитаемого формата — regex-конвертер достаточен
- [ ] Валидация: для каждого stage число вопросов в JSON == числу `q:` в исходном index.html; все `correct` в пределах `options`; `cat` непустой
- [ ] Прогнать скрипт, закоммитить 10 JSON

**Acceptance:**
- 10 валидных JSON-файлов, суммарное число вопросов совпадает с текущим (etap0–9)
- Скрипт идемпотентен и повторяем (`python Scripts/extract_quiz_data.py`)

---

### F1 · Unit 2: Quiz-страница на bundle + build-hook

**Цель:** `docs/tools/quiz/index.html` грузит данные из сгенерированного `stages-bundle.js`; встроенный массив удалён.

**Файлы:**
- `hooks/quiz_bundle.py` (создать)
- `mkdocs.yml` (раздел `hooks:` — добавить)
- `docs/tools/quiz/index.html` (заменить ~4500 строк данных на `<script src="stages-bundle.js">`)

**Задачи:**
- [ ] Hook: читать все `docs/assets/data/quiz/*.json`, писать `site/tools/quiz/stages-bundle.js` с `window.POTOK_QUIZ_STAGES = […];` (после build, до deploy)
- [ ] index.html: инициализация из `window.POTOK_QUIZ_STAGES`; при отсутствии — понятный экран «данные не загружены» (защита от file:// без сборки)
- [ ] Удалить встроенные данные из index.html; проверить, что UI/логика/SFX не тронуты
- [ ] Тест: `mkdocs build` → открыть `site/tools/quiz/index.html` и по `file://`; все 10 этапов работают, `?stage=etap2` работает

**Acceptance:**
- Quiz идентичен по поведению до/после; в репо данные только в JSON (нет дублей)
- Сборка + deploy workflow проходят

---

### F1 · Unit 3: Fence `quiz` для Markdown

**Цель:** В уроках писать ```` ```quiz stage="etap2" count=5 cats="Компрессия" ```` → на выходе `<div class="potok-quiz-inline" data-stage="etap2" data-count="5" data-cats="…">`.

**Файлы:**
- `hooks/quiz_fence.py` (создать)
- `mkdocs.yml` (`markdown_extensions.pymdownx.superfences.custom_fences`)

**Задачи:**
- [ ] Форматтер superfences: парсить атрибуты первой строки fence'а (`stage`, `count`, `cats`), валидировать stage (etap0–9), эскейпить значения
- [ ] Без атрибутов — дефолт: stage из пути страницы (regex `/etap(\d)/`), count=5; если stage не определён — рендер заглушки с предупреждением в консоль
- [ ] Добавить fence в mkdocs.yml рядом с mermaid

**Acceptance:**
- Тестовый .md с тремя вариантами fence'а собираетcя в корректные div'ы; `mkdocs build` без ошибок

---

### F1 · Unit 4: Виджет инлайн-квиза (JS + UI)

**Цель:** `inline-quiz.js` — рендер вопросов, ответы с мгновенной обратной связью, итог.

**Файлы:**
- `docs/assets/javascripts/inline-quiz.js` (создать)
- `mkdocs.yml` (`extra_javascript`)

**Задачи:**
- [ ] На DOMContentLoaded: найти `.potok-quiz-inline`, для каждого fetch `{root}/assets/data/quiz/{stage}.json` (root вычислять из `document.currentScript.src` — работает и на `/potoksite/…`, и на `mkdocs serve`)
- [ ] Выборка: count + cats, seed = YYYYMMDD+stage (стабильно в течение дня)
- [ ] UI: карточка в стиле сайта (`--bg-card`, `--border-default`), вопросы списком, варианты — кнопки; клик → правильный подсвечивается оранжевым/зелёным, неверный — красным, раскрывается `comment`; прогресс «2/5»
- [ ] Итоговая панель: score, «Рекорд! +N XP» (если рекорд), кнопка «Пройти ещё раз» (перемешивает)
- [ ] Состояния: ошибка fetch → аккуратная заглушка; `prefers-reduced-motion` — без анимаций

**Acceptance:**
- На тестовой странице квиз работает в обеих темах и на мобильной ширине (360px); комментарии раскрываются; повторное прохождение перемешивает вопросы

---

### F1 · Unit 5: Интеграция с геймификацией

**Цель:** XP, статистика и бейджи за инлайн-квизы.

**Файлы:**
- `docs/assets/javascripts/gamification.js` (изменить)
- `docs/assets/javascripts/inline-quiz.js` (вызов API)

**Задачи:**
- [ ] `defaultStats()`: добавить `quizzesDone: 0, quizCorrect: 0, perfectQuizzes: 0` (старые сохранённые stats не ломаются — читать через `(stats.x||0)`)
- [ ] `BADGE_DEFS`: `quiz_first`, `quiz_perfect`, `quiz_master` (иконки в стиле существующих)
- [ ] В виджете по завершении: сравнить score с `potok-quiz-best-{stage}`; новый рекорд → `PotokGamification.addXP(10*score, 'quiz_'+stage)` + запись best тем же форматом `{score,total,date}`, что у standalone quiz; обновить stats
- [ ] Проверить, что тосты XP/бейджей/level-up срабатывают штатно

**Acceptance:**
- Первое прохождение: +XP, тост, рекорд сохранён; повтор с тем же score — без XP; идеальный результат даёт `quiz_perfect`; бейджи видны на странице «Бейджи»

---

### F1 · Unit 6: Контентный пилот — квизы в уроках

**Цель:** Первые инлайн-квизы в реальных статьях.

**Файлы (пилот, 5 статей):**
- `docs/etap2/compression-kompressiya.md` — `count=4 cats="Компрессия"` (или ближайшая cat)
- `docs/etap2/eq-ekvalizatsiya.md`, `docs/etap2/reverb-reverberation.md` (проверить реальные cat'ы в JSON)
- `docs/etap1/drumka.md`, `docs/etap4/intervaly.md`

**Задачи:**
- [ ] Для каждой статьи подобрать cat'ы по данным JSON и вставить fence перед блоком «Назад/Далее»
- [ ] Проверить, что вопросы реально соответствуют теме урока (ручная вычитка выбранных вопросов)

**Acceptance:**
- `mkdocs build` чистый; на 5 страницах квизы рендерятся с релевантными вопросами

---

### F2 · Unit 1: Каркас палитры

**Цель:** Ctrl+K открывает оверлей-палитру (пока без результатов).

**Файлы:**
- `docs/assets/javascripts/search-ctrlk.js` (переписать)
- `docs/assets/stylesheets/extra.css` (стили палитры, оба режима темы)

**Задачи:**
- [ ] Оверлей: инпут + список + футер с подсказками клавиш; создание DOM из JS (без правки шаблона Material)
- [ ] Открытие по Ctrl/Cmd+K (текущий хендлер заменить), закрытие по Esc, focus-trap, возврат фокуса
- [ ] Стили: центрирование сверху ~15vh, `--bg-card`/`--border-default`, активный пункт — оранжевая подсветка; мобильная версия

**Acceptance:**
- Ctrl+K открывает/закрывает палитру, Esc работает, фокус не «убегает», обе темы выглядят в стиле сайта

---

### F2 · Unit 2: Поиск по страницам

**Цель:** Живой поиск по всему сайту через `search_index.json`.

**Файлы:**
- `docs/assets/javascripts/search-ctrlk.js`

**Задачи:**
- [ ] Ленивый fetch `{root}/search/search_index.json` при первом открытии, кэш в памяти; обработка ошибки (офлайн/404) — показать только команды
- [ ] Fuzzy: subsequence scoring + бонус за префикс и совпадение слова; ранжирование title > location > text
- [ ] Результаты: до 8 страниц, подпись с разделом (location), переход по Enter/клику (url + якорь)

**Acceptance:**
- Запрос «компресс» находит Compression; «реверб вокал» — релевантные страницы; пустой запрос показывает команды и недавние

---

### F2 · Unit 3: Команды

**Цель:** Статические команды с иконками Lucide.

**Файлы:**
- `docs/assets/javascripts/search-ctrlk.js`

**Задачи:**
- [ ] Массив команд: «Тёмная тема» / «Светлая тема» (динамический label по текущей схеме), 10× «Этап №N», инструменты (Wavetable, EQ-тренажёр, Браузерная DAW, Квиз, Карта частот, Harmony Map, Waveforms…), Словарь/FAQ/Бейджи/Статистика/Маршрут
- [ ] Исполнители: навигация — `location.href`; тема — клик по toggle в `.md-header__options`, fallback ручная смена схемы + localStorage Material
- [ ] «Недавние» (5 шт., localStorage) поверх списка команд при пустом запросе

**Acceptance:**
- Каждая команда работает из палитры; переключение темы мгновенно и корректно сохраняется

---

### F2 · Unit 4: Полировка

**Файлы:** `search-ctrlk.js`, `extra.css`

**Задачи:**
- [ ] Подсветка совпавших символов в результатах
- [ ] Анимация появления (150ms, уважать `prefers-reduced-motion`)
- [ ] Видимая подсказка: маленький чип «Ctrl K» на главной/в футере (по решению при реализации)

**Acceptance:**
- Чек-лист UX: клавиатура полностью, мышь полностью, мобильный тап, обе темы, без дёрганий

---

### F3 · Unit 1: Аудио-движок (синтез + луп + A/B)

**Цель:** Слышимый бит и переключение до/после.

**Файлы:**
- `docs/assets/javascripts/compressor-widget.js` (создать, каркас движка)

**Задачи:**
- [ ] Синтез AudioBuffer 2 такта @90 BPM: kick/snare/closed-hat паттерн в стиле курса; нормализация пика ~ -6 dBFS
- [ ] Плейбек лупа (AudioBufferSourceNode + loop), play/stop без щелчков (gain ramp)
- [ ] A/B bypass: два буфера (dry / processed-заглушка), кроссфейд 10 мс, большая оранжевая кнопка

**Acceptance:**
- Бит играет чисто и зациклено; bypass переключает без артефактов; AudioContext стартует по жесту пользователя

---

### F3 · Unit 2: DSP компрессора + GR-метр

**Файлы:** `compressor-widget.js`

**Задачи:**
- [ ] Envelope follower (attack/release, time constants из мс), soft-knee кривая (ширина колена ~6 дБ), threshold/ratio/makeup
- [ ] Оффлайн-обработка лупа → processed buffer; пере-рендер при смене параметров (debounce 150 мс)
- [ ] GR-метр: текущее снижение в дБ, VU-бар (canvas), синхронизирован с воспроизведением

**Acceptance:**
- Threshold -20→-35 дБ слышно и видно; ratio 2:1 vs 8:1 различим; GR-метр «дышит» в такт биту; пере-рендер < 300 мс

---

### F3 · Unit 3: UI виджета (canvas + контролы)

**Файлы:** `compressor-widget.js`, `docs/assets/stylesheets/compressor.css` (создать), `mkdocs.yml` (extra_css/js)

**Задачи:**
- [ ] Canvas: наложение волн input (серый) / output (`--accent-orange`) + transfer curve с живым маркером рабочей точки
- [ ] Слайдеры: threshold (-40…0), ratio (1…20, log), attack (0.1…100 мс, log), release (10…1000 мс, log), makeup (-12…+12) — стилизация под дизайн-токены
- [ ] Пресеты: «Мелодия 2:1 slow», «Snare punch fast attack», «Bus 1.5:1» (значения из таблицы статьи)
- [ ] Иконки Lucide оранжевые; обе темы; мобильная раскладка (canvas сверху, контролы снизу)

**Acceptance:**
- Виджет в стиле сайта на 360px и 1440px; пресеты применяются одним кликом; маркер на transfer curve двигается во время воспроизведения

---

### F3 · Unit 4: Интеграция (standalone + статья)

**Файлы:**
- `docs/tools/compressor/index.html` (создать — тонкая обёртка с заголовком и back-link, как у других инструментов)
- `docs/etap2/compression-kompressiya.md` (вставить `<div class="potok-compressor"></div>` после секции «Параметры компрессора» + 1–2 предложения интро)
- `docs/tools/index.html` (карточка инструмента)

**Задачи:**
- [ ] Виджет инициализируется по `.potok-compressor[data-preset]`; standalone-страница — тот же модуль в полном размере
- [ ] Ссылка из статьи на полную страницу инструмента; карточка в tools/index.html
- [ ] Финальная проверка: `mkdocs build`, обе темы, file:// для tools/compressor

**Acceptance:**
- Сборка чистая; компрессор работает и в статье, и standalone; deploy workflow зелёный

---

## Порядок и зависимости

```
F1: U1 → U2 → (U3 ∥ U4) → U5 → U6        # U3/U4 параллельно
F2: U1 → U2 → U3 → U4                    # независима от F1/F3
F3: U1 → U2 → U3 → U4                    # независима от F1/F2
```

Рекомендуемый порядок запуска: **F3 (самая «вау»-фича, изолированная) → F1 → F2**, либо две ветки параллельно.

## Риски

| Риск | Митигация |
|---|---|
| Хрупкий парсинг STAGES из index.html (U1-F1) | Данные машиночитаемого формата; валидация счётчиков вопросов; при сбое — ручная починка одного файла |
| `search_index.json` может быть 1–3 МБ | Ленивый fetch + кэш; при ошибке — только команды |
| file://-режим quiz после рефактора (U2-F1) | Bundle через `<script src>` вместо fetch; экран ошибки как fallback |
| Щелчки/артефакты при A/B и пере-рендеринге | Кроссфейд 10 мс, debounce, gain ramp — прописано в acceptance |
| Старые localStorage stats без новых полей | Паттерн `(stats.x||0)` уже используется в gamification.js |
