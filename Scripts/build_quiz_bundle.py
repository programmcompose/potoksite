# -*- coding: utf-8 -*-
"""Генератор docs/assets/data/quiz/stages-bundle.js из etap*.json (идемпотентно).

Бандл — единая точка загрузки данных квиза для standalone-страницы и инлайн-виджета:
  window.POTOK_QUIZ_STAGES = [ ...10 этапов... ];

Запуск: python Scripts/build_quiz_bundle.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "docs" / "assets" / "data" / "quiz"
OUT_PATH = DATA_DIR / "stages-bundle.js"


def main() -> int:
    files = sorted(
        (p for p in DATA_DIR.glob("etap*.json") if re.fullmatch(r"etap\d+\.json", p.name)),
        key=lambda p: int(re.search(r"\d+", p.stem).group()),
    )
    if not files:
        print(f"ОШИБКА: нет etap*.json в {DATA_DIR}", file=sys.stderr)
        return 1

    stages = []
    for f in files:
        st = json.loads(f.read_text(encoding="utf-8"))
        stages.append(st)

    payload = json.dumps(stages, ensure_ascii=False, indent=2)
    out = (
        "// Сгенерировано Scripts/build_quiz_bundle.py из docs/assets/data/quiz/etap*.json — не редактировать вручную.\n"
        "// Источник данных: STAGES в docs/tools/quiz/index.html (миграция: Scripts/extract_quiz_data.py).\n"
        "window.POTOK_QUIZ_STAGES = " + payload + ";\n"
    )

    # Идемпотентность: перезаписываем только при изменении
    if OUT_PATH.exists() and OUT_PATH.read_text(encoding="utf-8") == out:
        print(f"OK: {OUT_PATH.relative_to(ROOT)} без изменений ({len(stages)} этапов)")
        return 0

    OUT_PATH.write_text(out, encoding="utf-8")
    total_q = sum(len(s.get("questions", [])) for s in stages)
    print(f"OK: записан {OUT_PATH.relative_to(ROOT)} — {len(stages)} этапов, {total_q} вопросов")
    return 0


if __name__ == "__main__":
    sys.exit(main())
