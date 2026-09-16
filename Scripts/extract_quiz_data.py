# -*- coding: utf-8 -*-
"""Одноразовая миграция (идемпотентна): STAGES из docs/tools/quiz/index.html -> JSON.

Вырезает текст массива `var STAGES = [ ... ];`, конвертирует JS-object-literal в JSON:
  - кавычки вокруг ключей; строки не трогаются;
  - вызовы SVG-функций (channelRackSVG() и т.п.) заменяются на ссылки
    {"svg": "имяФункции", "args": [...]} — сами функции остаются в index.html,
    страница квиза резолвит ссылки при рендере.

Валидация:
  - число вопросов на каждый stage == числу `q:` в исходном index.html;
  - все `correct` в пределах options;
  - `cat` непустой.

Запуск: python Scripts/extract_quiz_data.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUIZ_HTML = ROOT / "docs" / "tools" / "quiz" / "index.html"
OUT_DIR = ROOT / "docs" / "assets" / "data" / "quiz"

SVG_FNS = ["channelRackSVG", "waveformsSVG", "adsrSVG", "pianoKeysSVG", "swingRollSVG"]


def extract_stages_text(html: str) -> str:
    """Текст массива STAGES (включая внешние скобки)."""
    start_marker = "var STAGES = ["
    i = html.index(start_marker)
    depth = 0
    in_str = False
    j = i + len(start_marker) - 1  # позиция открывающей [
    n = len(html)
    while j < n:
        c = html[j]
        if in_str:
            if c == "\\":
                j += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return html[i + len(start_marker) - 1 : j + 1]
        j += 1
    raise RuntimeError("Не найден конец массива STAGES")


def _find_matching_close(text: str, open_idx: int) -> int:
    """Индекс закрывающего )/], соответствующего скобке в open_idx (учитывая строки)."""
    depth = 0
    in_str = False
    j = open_idx
    n = len(text)
    while j < n:
        c = text[j]
        if in_str:
            if c == "\\":
                j += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c in "([":
                depth += 1
            elif c in ")]":
                depth -= 1
                if depth == 0:
                    return j
        j += 1
    raise RuntimeError("Несогласованные скобки в STAGES")


def _args_to_json(inner: str):
    """Аргументы SVG-вызова -> JSON-массив (в данных только строки/числа)."""
    inner_s = inner.strip()
    if not inner_s:
        return None
    if not (inner_s.startswith("[") and inner_s.endswith("]")):
        raise RuntimeError("Неожиданные аргументы SVG-вызова: %r" % inner_s[:80])
    body = inner_s[1:-1].strip()
    if not body:
        return "[]"
    str_re = re.compile(r'"(?:[^"\\]|\\.)*"')
    tokens = str_re.findall(body)
    rest = str_re.sub("", body)
    for ch in rest:
        if ch not in " \t\n\r,":
            raise RuntimeError("Неожиданный токен в аргументах SVG-вызова: %r" % inner_s[:80])
    return json.dumps(tokens, ensure_ascii=False)


def replace_svg_calls(text: str) -> str:
    """image: someSVG(...) -> image: {"svg": "someSVG", "args": [...]}"""
    pattern = re.compile(r"\b(" + "|".join(SVG_FNS) + r")\s*\(")
    out = []
    i, n = 0, len(text)
    while i < n:
        m = pattern.search(text, i)
        if not m:
            out.append(text[i:])
            break
        name = m.group(1)
        call_start = m.start()
        open_idx = text.index("(", m.end() - 1)
        close_idx = _find_matching_close(text, open_idx)
        inner = text[open_idx + 1 : close_idx]
        out.append(text[i:call_start])
        obj = '{"svg": "%s"' % name
        args_json = _args_to_json(inner)
        if args_json is not None:
            obj += ', "args": %s' % args_json
        out.append(obj + "}")
        i = close_idx + 1
    return "".join(out)


def strip_block_comments(text: str) -> str:
    """Удаляет /* ... */ вне строк (в STAGES есть комментарии между этапами)."""
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            if c == "\\":
                out.append(text[i : i + 2])
                i += 2
                continue
            if c == '"':
                in_str = False
            out.append(c)
            i += 1
        else:
            if c == '"':
                in_str = True
                out.append(c)
                i += 1
            elif c == "/" and i + 1 < n and text[i + 1] == "*":
                end = text.find("*/", i + 2)
                if end == -1:
                    raise RuntimeError("Незакрытый блок-комментарий в STAGES")
                # Сохраняем структуру: заменяем комментарий на пробел
                out.append(" ")
                i = end + 2
            else:
                out.append(c)
                i += 1
    return "".join(out)


def js_literal_to_json(text: str) -> str:
    """Кавычки вокруг неэкранированных ключей; строки (двойные кавычки) не трогаем."""

    def quote_keys(m: re.Match) -> str:
        return '"%s":' % m.group(1)

    out = []
    i, n = 0, len(text)
    # Ключ в этом формате всегда идёт после пробельного символа (проверено по данным)
    key_re = re.compile(r"(?<=\s)([A-Za-z_][A-Za-z0-9_]*)\s*:")
    while i < n:
        c = text[i]
        if c == '"':
            j = i + 1
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == '"':
                    break
                j += 1
            out.append(text[i : j + 1])
            i = j + 1
        else:
            j = text.find('"', i)
            if j == -1:
                j = n
            chunk = text[i:j]
            out.append(key_re.sub(quote_keys, chunk))
            i = j
    return "".join(out)


def main() -> int:
    html = QUIZ_HTML.read_text(encoding="utf-8")
    stages_text = extract_stages_text(html)

    # Счётчик вопросов `q:` в исходнике (для валидации) — по этапам
    src_q_counts = {}
    for m in re.finditer(r'id:\s*"(etap\d+)"', stages_text):
        stage_id = m.group(1)
        nxt = re.search(r'id:\s*"etap\d+"', stages_text[m.end() :])
        end = m.end() + (nxt.start() if nxt else len(stages_text))
        block = stages_text[m.start() : end]
        src_q_counts[stage_id] = len(re.findall(r"^\s*q:\s*\"", block, flags=re.MULTILINE))

    data_json = js_literal_to_json(strip_block_comments(replace_svg_calls(stages_text)))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        stages = json.loads(data_json)
    except json.JSONDecodeError as e:
        print("ОШИБКА: не удалось распарсить STAGES как JSON:", file=sys.stderr)
        print(str(e), file=sys.stderr)
        (OUT_DIR / "_debug_stages.json").write_text(data_json, encoding="utf-8")
        return 1

    if not isinstance(stages, list):
        print("ОШИБКА: STAGES не является массивом", file=sys.stderr)
        return 1

    errors = []
    total_q = 0
    for st in stages:
        sid = st.get("id")
        if not re.fullmatch(r"etap\d+", str(sid or "")):
            errors.append(f"некорректный id: {sid!r}")
            continue
        qs = st.get("questions", [])
        total_q += len(qs)

        # Нормализация аудио-путей: от tools/quiz/ -> относительно корня docs/
        for qi, q in enumerate(qs):
            if "audio" in q and isinstance(q["audio"], str):
                p = q["audio"]
                if p.startswith("../../"):
                    q["audio"] = p[len("../../"):]
            for a in q.get("audios", []) or []:
                # src относительный от tools/quiz/ -> делаем относительно корня docs/
                if isinstance(a, dict) and "src" in a and not str(a["src"]).startswith(("../../", "/")):
                    a["src"] = "tools/quiz/" + a["src"]
            # Проверка существования файлов
            for p in [q.get("audio")] + [a.get("src") for a in q.get("audios", []) or [] if isinstance(a, dict)]:
                if p and not (ROOT / "docs" / p).exists():
                    errors.append(f"{sid} q{qi}: нет файла {p}")

        for qi, q in enumerate(qs):
            opts = q.get("options", [])
            if not isinstance(opts, list) or len(opts) < 2:
                errors.append(f"{sid} q{qi}: options < 2")
            corr = q.get("correct")
            if not isinstance(corr, int) or not (0 <= corr < len(opts)):
                errors.append(f"{sid} q{qi}: correct={corr!r} вне диапазона options({len(opts)})")
            cat = q.get("cat", "")
            if not str(cat).strip():
                errors.append(f"{sid} q{qi}: пустой cat")

        src_n = src_q_counts.get(sid)
        if src_n is None:
            errors.append(f"{sid}: нет блока в исходнике для сравнения")
        elif src_n != len(qs):
            errors.append(f"{sid}: вопросов в JSON {len(qs)} != {src_n} в index.html")

        out_path = OUT_DIR / f"{sid}.json"
        out_path.write_text(
            json.dumps(st, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"  {out_path.relative_to(ROOT)}: {len(qs)} вопросов")

    src_total = sum(src_q_counts.values())
    if errors:
        for e in errors:
            print("ОШИБКА:", e, file=sys.stderr)
        return 1

    print(f"\nOK: {len(stages)} этапов, {total_q} вопросов (в исходнике: {src_total})")
    if total_q != src_total:
        print(f"ОШИБКА: суммарное число вопросов не совпадает ({total_q} != {src_total})", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
