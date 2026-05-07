## Environment

- **Python 3.13**: `C:\Python313_old\python.exe`
- **MkDocs**: site generator, config in `mkdocs.yml`

## Project Structure

- **`docs/`** — источник Markdown-контента (исходники сайта)
- **`site/`** — сгенерированный HTML-сайт (не редактировать вручную)
- **`site/tools/`** — интерактивные инструменты (HTML/JS): чеклист, wavetable, EQ-тренажёр и др.
- **`docs/tools/`** — исходники интерактивных инструментов
- **`docs/assets/`** — CSS, JS и медиа для сайта
- **`Lib/`** — локальные Python-библиотеки (site-packages)
- **`Scripts/`** — Python-скрипты и бинарники
- **`requirements.txt`** — Python-зависимости (mkdocs-material, glightbox, mermaid2, graph-plugin)
- **`mkdocs.yml`** — конфигурация MkDocs (тема, плагины, навигация)

## Build

- Сборка: `mkdocs build`
- Dev-сервер: `mkdocs serve`

## Screenshots and Images

- Сохраняй готовые изображения в `docs/assets/`.
- **Скачивание картинок по прямой ссылке**: используй PowerShell `Invoke-WebRequest`. Пример:
  ```powershell
  Invoke-WebRequest -Uri "https://example.com/image.png" -OutFile "C:\Users\IYBETOS\potoksite\docs\assets\filename.png" -UseBasicParsing
  ```
  Это работает для прямых ссылок на изображения (.png, .jpg, .jpeg). Проще и быстрее Playwright.
- **Поиск URL изображений**: если прямой URL неизвестен, ищи его в HTML-коде страницы через `webfetch` (парси `src` атрибуты `<img>` тегов) или на сайтах-источниках (официальные сайты плагинов, документация, блоги).
- **Если прямое скачивание не работает** (403, блокировка): используй Browser-скилл (Playwright) для скриншота страницы.

## Стиль и дизайн

- При добавлении новых элементов на сайт придерживайся существующей палитры и стилистики из `docs/assets/stylesheets/extra.css`.
- Используй CSS-переменные (design tokens): `--accent-orange`, `--accent-blue`, `--bg-card`, `--text-main` и др.
- Не вводи новые цвета без необходимости — выдерживай единый визуальный стиль сайта.
- Для тёмной темы ([data-md-color-scheme="slate"]) и светлой ([data-md-color-scheme="default"]) дублируй стили, как это сделано в CSS.

## Иконки

- **Только Lucide icons.** Используй `<i data-lucide="icon-name" class="..."></i>`. Никаких эмодзи, Material Design Icons, Font Awesome или других наборов.
- **Цвет иконок:** всегда `--accent-orange` (оранжевый). Никаких синих, зелёных или других цветов для иконок.
- Пример: `<i data-lucide="help-circle" class="page-icon"></i>`

## Git Workflow

- После каждого завершенного изменения — **немедленно** `git add .`, `git commit "x"` с описательным сообщением в "x" и `git push`. Не спрашивать разрешения, коммитить автоматически.
