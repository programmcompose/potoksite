# -*- coding: utf-8 -*-
"""Тесты хука hooks/glossary_json.py — категории терминов и бейджи на странице.

Запуск: C:/Python313_old/python.exe tests/test_glossary_hook.py
"""
import importlib.util
import os
import re
import sys
import tempfile
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK_PATH = os.path.join(HERE, "..", "hooks", "glossary_json.py")
GLOSSARY_MD = os.path.join(HERE, "..", "docs", "glossary.md")


def load_hook():
    spec = importlib.util.spec_from_file_location("glossary_json", HOOK_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_glossary_md():
    with open(GLOSSARY_MD, "r", encoding="utf-8") as f:
        return f.read()


def fake_page(name):
    return SimpleNamespace(file=SimpleNamespace(src_path=name))


ALLOWED_CATS = {"theory", "physics", "mixing", "effects", "equipment", "daw"}


def test_terms_extracted():
    g = load_hook()
    terms = g.extract_glossary(GLOSSARY_MD)
    assert len(terms) == 82, f"ожидалось 82 термина, получено {len(terms)}"
    for t in terms:
        assert t["term"].strip(), "пустой term"
        assert t["definition"].strip(), f"пустое определение у {t['term']}"
        assert t["slug"], f"пустой slug у {t['term']}"
    adsr = next(t for t in terms if t["term"].startswith("ADSR"))
    assert "огибающая" in adsr["definition"], adsr["definition"]


def test_category_field_present():
    g = load_hook()
    terms = g.extract_glossary(GLOSSARY_MD)
    from collections import Counter
    counts = Counter(t.get("category") for t in terms)
    assert None not in counts, f"термины без категории: {counts}"
    assert set(counts) <= ALLOWED_CATS, f"неизвестные категории: {set(counts)}"
    expected = {"effects": 25, "mixing": 21, "physics": 15, "daw": 10, "theory": 6, "equipment": 5}
    assert dict(counts) == expected, f"распределение не совпадает: {dict(counts)}"


def test_badges_injected_into_glossary_page():
    g = load_hook()
    md = read_glossary_md()
    out = g.on_page_markdown(md, page=fake_page("glossary.md"), config=None)
    badges = re.findall(r'<span class="gl-badge gl-cat-(\w+)" data-cat="\1">', out)
    assert len(badges) == 82, f"ожидалось 82 бейджа, получено {len(badges)}"
    # бейджен вставлен сразу после жирного термина, до «—»
    m = re.search(r"\*\*Bus \(Шина\)\*\* <span class=\"gl-badge gl-cat-mixing\"[^>]*>[^<]+</span>\s*—", out)
    assert m, "бейдж категории не вставлен после **Bus (Шина)**"
    # текст термина и определения не повреждены
    assert "**Bus (Шина)**" in out and "виртуальный канал" in out


def test_other_pages_untouched():
    g = load_hook()
    md = "# Заголовок\n\n**Не термин** — просто жирный текст.\n"
    out = g.on_page_markdown(md, page=fake_page("index.md"), config=None)
    assert out == md, "хук не должен трогать страницы, кроме glossary.md"


def test_extract_still_works_after_injection():
    """После вставки бейджей парсер (glossary.json для тултипов) работает как раньше."""
    g = load_hook()
    md = read_glossary_md()
    injected = g.on_page_markdown(md, page=fake_page("glossary.md"), config=None)
    with tempfile.NamedTemporaryFile("w", suffix=".md", encoding="utf-8", delete=False) as f:
        f.write(injected)
        tmp_path = f.name
    try:
        before = g.extract_glossary(GLOSSARY_MD)
        after = g.extract_glossary(tmp_path)
        assert len(after) == len(before) == 82, (len(before), len(after))
        for b, a in zip(before, after):
            assert b["slug"] == a["slug"], (b["slug"], a["slug"])
            assert b["definition"] == a["definition"], f"определение изменилось у {b['term']}"
    finally:
        os.unlink(tmp_path)


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
