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

- Когда пользователь просит скриншоты сайтов, картинки из интернета или примеры визуального оформления — используй Browser-скилл (Playwright), чтобы открыть страницу и сделать скриншот. Сохраняй готовые изображения в `docs/assets/`.

## Git Workflow

- После каждого завершенного изменения — **немедленно** `git add .`, `git commit "x"` с описательным сообщением в "x" и `git push`. Не спрашивать разрешения, коммитить автоматически.
