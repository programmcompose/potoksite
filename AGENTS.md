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

## Git Workflow

- После каждого завершенного изменения — **немедленно** `git add`, `git commit` с описательным сообщением и `git push`. Не спрашивать разрешения, коммитить автоматически.
