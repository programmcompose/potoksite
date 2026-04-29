# 🎵 Создание музыки — Интерактивный курс

Полный курс по созданию музыки: от основ звука до мастеринга.

[![Deploy Status](https://github.com/programmcompose/potoksite/actions/workflows/deploy.yml/badge.svg)](https://github.com/programmcompose/potoksite/actions)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## 📚 О курсе

Это бесплатный интерактивный курс по созданию музыки, covering:

- **Том I:** Основы звукозаписи (физика звука, оборудование, DAW)
- **Том II:** Теория музыки для продюсеров (ноты, аккорды, ритм)
- **Том III:** Практика производства (запись, сведение, мастеринг)
- **Глоссарий** терминов музыкального производства
- **Маршрут обучения** на 12 недель

## 🚀 Быстрый старт

### Предварительные требования

- Python 3.8+
- Git

### Установка и запуск

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/programmcompose/potoksite.git
cd potoksite

# 2. Установите зависимости
pip install -r requirements.txt

# 3. Запустите локальный сервер
mkdocs serve

# 4. Откройте в браузере
# http://127.0.0.1:8000
```

Сервер автоматически перезагружается при изменении файлов.

## 📁 Структура проекта

```
potoksite/
├── docs/                          # Markdown-файлы с контентом
│   ├── index.md                   # Главная страница
│   ├── tom1/                      # Том I: Основы звукозаписи
│   │   ├── index.md
│   │   ├── osnovy-zvuka.md
│   │   ├── oborudovanie.md
│   │   └── daw.md
│   ├── tom2/                      # Том II: Теория музыки
│   │   ├── index.md
│   │   ├── notnaya-gramota.md
│   │   ├── akkordy.md
│   │   └── ritm.md
│   ├── tom3/                      # Том III: Практика производства
│   │   ├── index.md
│   │   ├── zapis.md
│   │   ├── mixing.md
│   │   └── mastering.md
│   ├── roadmap.md                 # Маршрут обучения
│   ├── glossary.md                # Глоссарий
│   └── assets/
│       ├── images/                # Изображения
│       ├── audio/                 # Аудио-файлы
│       └── stylesheets/
│           └── extra.css          # Кастомные стили
├── mkdocs.yml                     # Конфигурация MkDocs
├── requirements.txt               # Python-зависимости
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions для автодеплоя
└── README.md                      # Этот файл
```

## ✍️ Как добавить новую статью

1. Создайте `.md` файл в папке `/docs/` (или в соответствующем томе)
2. Добавьте ссылку в `mkdocs.yml` в секции `nav`
3. Запустите `mkdocs serve` для проверки
4. Закоммитьте и запушьте — сайт обновится автоматически

### Пример новой статьи

```markdown
# Заголовок статьи

Ваш контент здесь.

## Подзаголовок

> [!TIP]
> Используйте admonitions для примечаний.

| Колонка 1 | Колонка 2 |
|-----------|-----------|
| Данные    | Данные    |

[Ссылка на другую статью →](другая-статья.md)
```

## 🎨 Технологии

- **[MkDocs](https://www.mkdocs.org/)** — статический генератор сайтов
- **[MkDocs Material](https://squidfunk.github.io/mkdocs-material/)** — тема с тёмным режимом
- **[glightbox](https://github.com/squidfunk/mkdocs-glightbox)** — просмотр изображений
- **[Mermaid](https://mermaid.js.org/)** — диаграммы в Markdown
- **[GitHub Actions](https://github.com/features/actions)** — автоматический деплой

## ⚙️ Настройка GitHub Pages

1. Перейдите в **Settings → Pages** вашего репозитория
2. Убедитесь, что Source установлен в **GitHub Actions**
3. При push в `main` сайт автоматически развернётся

## 🔧 Настройка под себя

### Изменить название сайта

Отредактируйте `mkdocs.yml`:

```yaml
site_name: "Ваше название"
```

### Изменить цвета

```yaml
theme:
  palette:
    primary: purple      # primary цвет
    accent: teal         # accent цвет
```

### Добавить страницу в навигацию

```yaml
nav:
  - "Новый раздел": "new-page.md"
```

## 📝 Лицензия

Контент распространяется под лицензией
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Код распространяется под лицензией MIT.

## 🤝 Вклад

1. Fork репозиторий
2. Создайте branch (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📬 Обратная связь

Нашли ошибку? Есть предложение? Откройте
[Issue](https://github.com/programmcompose/potoksite/issues) или
создайте Pull Request.
