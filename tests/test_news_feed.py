# -*- coding: utf-8 -*-
"""Тесты хука hooks/news_feed.py — сбор данных постов «Новости Потока».

Запуск: C:/Python313_old/python.exe tests/test_news_feed.py
"""
import importlib.util
import json
import os
import sys
import tempfile
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK_PATH = os.path.join(HERE, "..", "hooks", "news_feed.py")


def load_hook():
    spec = importlib.util.spec_from_file_location("news_feed", HOOK_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_post(root: str, name: str, content: str):
    path = os.path.join(root, "posts")
    os.makedirs(path, exist_ok=True)
    with open(os.path.join(path, name), "w", encoding="utf-8") as f:
        f.write(textwrap.dedent(content).lstrip())


def make_posts_dir():
    tmp = tempfile.mkdtemp(prefix="news_test_")
    write_post(tmp, "post-a.md", """
        ---
        title: "Пост А"
        date: 2026-10-05
        type: этап
        image: assets/news/cover-a.png
        teaser: "Тизер А"
        ---

        # Заголовок тела

        Текст поста **А** со *списком*:

        - пункт 1
        - пункт 2
    """)
    write_post(tmp, "post-b.md", """
        ---
        title: "Пост Б"
        date: 2026-10-20
        type: ивент
        teaser: "Тизер Б"
        ---

        Тело поста Б.
    """)
    write_post(tmp, "post-c.md", """
        ---
        title: "Пост без типа"
        date: 2026-10-01
        teaser: "Без type и image"
        ---

        Короткое тело.
    """)
    return tmp


def test_sorting_and_fields():
    nf = load_hook()
    posts, warnings = nf.collect_posts(make_posts_dir())
    assert len(posts) == 3, f"ожидалось 3 поста, получено {len(posts)}: {warnings}"
    # сортировка по дате убыванию
    dates = [p["date"] for p in posts]
    assert dates == sorted(dates, reverse=True), f"не отсортировано: {dates}"
    first = posts[0]
    assert first["title"] == "Пост Б", first["title"]
    assert first["type"] == "ивент"
    assert first["teaser"] == "Тизер Б"
    # image нормализуется в абсолютный путь от корня сайта
    a = next(p for p in posts if p["title"] == "Пост А")
    assert a["image"] == "/assets/news/cover-a.png", a["image"]
    # тело конвертировано в HTML, а не сырой markdown
    assert "<strong>А</strong>" in a["body_html"] and "<li>пункт 1</li>" in a["body_html"], a["body_html"]
    assert "**А**" not in a["body_html"]
    # slug = имя файла без расширения
    assert a["slug"] == "post-a", a["slug"]


def test_defaults_for_missing_fields():
    nf = load_hook()
    posts, warnings = nf.collect_posts(make_posts_dir())
    c = next(p for p in posts if p["title"] == "Пост без типа")
    assert c["type"] == "инфо", f"тип по умолчанию должен быть «инфо», а не {c['type']!r}"
    assert c["image"] is None, c["image"]


def test_future_posts_included():
    """Будущие посты тоже включаются — фильтрация по дате клиентская."""
    nf = load_hook()
    tmp = tempfile.mkdtemp(prefix="news_test_")
    write_post(tmp, "future.md", """
        ---
        title: "Будущий"
        date: 2099-01-01
        type: инфо
        teaser: "Ещё не вышел"
        ---

        Тело.
    """)
    posts, warnings = nf.collect_posts(tmp)
    assert len(posts) == 1 and posts[0]["date"] == "2099-01-01", (posts, warnings)


def test_invalid_post_skipped_with_warning():
    nf = load_hook()
    tmp = tempfile.mkdtemp(prefix="news_test_")
    write_post(tmp, "no-title.md", """
        ---
        date: 2026-10-05
        type: инфо
        teaser: "Нет заголовка"
        ---

        Тело.
    """)
    write_post(tmp, "bad-date.md", """
        ---
        title: "Кривая дата"
        date: 05/10/2026
        type: инфо
        teaser: "Дата не ISO"
        ---

        Тело.
    """)
    write_post(tmp, "ok.md", """
        ---
        title: "Нормальный"
        date: 2026-10-05
        type: инфо
        teaser: "ОК"
        ---

        Тело.
    """)
    posts, warnings = nf.collect_posts(tmp)
    assert len(posts) == 1 and posts[0]["title"] == "Нормальный", (posts, warnings)
    assert len(warnings) == 2, f"ожидалось 2 warning, получено {len(warnings)}: {warnings}"


def test_empty_dir():
    nf = load_hook()
    tmp = tempfile.mkdtemp(prefix="news_test_")
    posts, warnings = nf.collect_posts(tmp)
    assert posts == [] and warnings == [], (posts, warnings)


def test_json_embed_safe():
    """JSON для встраивания в <script> не содержит «<» — нельзя выйти из тега."""
    nf = load_hook()
    tmp = tempfile.mkdtemp(prefix="news_test_")
    write_post(tmp, "xss.md", """
        ---
        title: "Тест </script><b>"
        date: 2026-10-05
        type: инфо
        teaser: "тизер"
        ---

        Тело с <img src=x onerror=alert(1)>.
    """)
    posts, warnings = nf.collect_posts(tmp)
    raw = nf.build_news_json(posts)
    assert "<" not in raw, "в JSON для <script> не должно быть «<»"
    data = json.loads(raw)  # round-trip работает
    assert len(data) == 1
    assert "</script>" in data[0]["title"]  # после decode всё на месте


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
