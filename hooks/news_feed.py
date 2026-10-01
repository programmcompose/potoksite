# -*- coding: utf-8 -*-
"""Хук «Новости Потока».

Собирает посты из docs/news/posts/*.md (frontmatter: title, date, type, image,
teaser + тело) и встраивает JSON всех постов — включая будущие — в контекст
страницы news/index.md. Фильтрация по дате происходит на клиенте (JS), чтобы
посты появлялись сами без пересборки сайта.

Формат поста:
    ---
    title: "Название"
    date: 2026-10-15          # ISO, дата публикации (граница — 00:00 МСК)
    type: этап                # этап | ивент | инфо
    image: assets/news/x.png  # опционально, путь от docs/
    teaser: "Коротко"
    ---
    Тело поста (markdown).
"""

import json
import logging
import os
from datetime import date as _date
from typing import Any

import markdown
import yaml

log = logging.getLogger("mkdocs.news_feed")

VALID_TYPES = ("этап", "ивент", "инфо")
DEFAULT_TYPE = "инфо"
_MD_EXTENSIONS = ["fenced_code", "tables", "attr_list"]

# Кэш на время сборки: (news_dir) -> posts
_posts_cache: dict[str, list[dict[str, Any]]] = {}


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Возвращает (frontmatter, тело). Если frontmatter нет — ({}, весь текст)."""
    if not text.startswith("---"):
        return {}, text
    lines = text.split("\n")
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            block = "\n".join(lines[1:i])
            body = "\n".join(lines[i + 1:])
            data = yaml.safe_load(block) or {}
            if not isinstance(data, dict):
                return {}, text
            return data, body.lstrip("\n")
    return {}, text


def _normalize_image(value: Any) -> str | None:
    if not value:
        return None
    path = str(value).strip().replace("\\", "/")
    if not path:
        return None
    if not path.startswith("/"):
        path = "/" + path
    return path


def _parse_date(value: Any) -> str | None:
    """Валидная ISO-дата (YYYY-MM-DD) или None."""
    if value is None:
        return None
    if isinstance(value, _date):  # yaml сам парсит даты в datetime.date
        return value.isoformat()
    s = str(value).strip()
    try:
        return _date.fromisoformat(s).isoformat()
    except ValueError:
        return None


def collect_posts(news_dir: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Собирает посты из <news_dir>/posts/*.md.

    Возвращает (posts, warnings): посты отсортированы по дате убыванию;
    невалидные файлы пропускаются с warning, сборка не падает.
    """
    posts: list[dict[str, Any]] = []
    warnings: list[str] = []
    posts_dir = os.path.join(news_dir, "posts")
    if not os.path.isdir(posts_dir):
        return posts, warnings

    for fname in sorted(os.listdir(posts_dir)):
        if not fname.lower().endswith(".md"):
            continue
        if fname.lower() == "readme.md":
            continue  # документация формата поста, не пост
        fpath = os.path.join(posts_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                text = f.read()
        except OSError as e:
            warnings.append(f"news_feed: не удалось прочитать {fname}: {e}")
            continue

        meta, body = _parse_frontmatter(text)
        title = str(meta.get("title", "")).strip()
        if not title:
            warnings.append(f"news_feed: {fname} — нет title в frontmatter, пост пропущен")
            continue
        post_date = _parse_date(meta.get("date"))
        if not post_date:
            warnings.append(
                f"news_feed: {fname} — date отсутствует или не в формате YYYY-MM-DD "
                f"(получено: {meta.get('date')!r}), пост пропущен"
            )
            continue

        raw_type = str(meta.get("type", "")).strip().lower() or DEFAULT_TYPE
        if raw_type not in VALID_TYPES:
            warnings.append(
                f"news_feed: {fname} — неизвестный type {raw_type!r}, использован «{DEFAULT_TYPE}»"
            )
            raw_type = DEFAULT_TYPE

        posts.append(
            {
                "slug": os.path.splitext(fname)[0],
                "title": title,
                "date": post_date,
                "type": raw_type,
                "image": _normalize_image(meta.get("image")),
                "teaser": str(meta.get("teaser", "")).strip(),
                "body_html": markdown.markdown(body.strip(), extensions=_MD_EXTENSIONS),
            }
        )

    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return posts, warnings


def build_news_json(posts: list[dict[str, Any]]) -> str:
    """JSON для встраивания в <script type="application/json">.

    «<» экранируется как \\u003c — содержимое не может выйти из тега script.
    """
    raw = json.dumps(posts, ensure_ascii=False, separators=(",", ":"))
    return raw.replace("<", "\\u003c")


def on_page_context(context: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    page = kwargs.get("page")
    config = kwargs.get("config")
    if page is None or config is None:
        return context
    src_path = ""
    try:
        src_path = page.file.src_path.replace(os.sep, "/")
    except AttributeError:
        pass
    if not src_path.startswith("news/"):
        return context

    news_dir = os.path.join(config["docs_dir"], "news")
    if news_dir in _posts_cache:
        posts = _posts_cache[news_dir]
    else:
        posts, warnings = collect_posts(news_dir)
        for w in warnings:
            log.warning(w)
        _posts_cache[news_dir] = posts

    context["news_feed_json"] = build_news_json(posts)
    return context
