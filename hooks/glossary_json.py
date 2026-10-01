# -*- coding: utf-8 -*-
"""Хук глоссария: glossary.json для тултипов + бейджи категорий на странице.

- on_post_build: парсит docs/glossary.md -> site/glossary.json (тултипы по сайту).
- on_page_markdown: в markdown страницы glossary.md вставляет после каждого
  термина <span class="gl-badge gl-cat-{cat}" data-cat="{cat}">Метка</span> —
  JS (glossary-filter.js) строит из них фильтры.
"""
import json
import os
import re
import pathlib

# --- Категории терминов -------------------------------------------------
# slug термина -> ключ категории. Slug считается функцией _slugify() ниже.
GLOSSARY_CATEGORIES = {
    "ableton-live": "daw",
    "adsr-attack-decay-sustain-release": "effects",
    "amplifier-амплификатор-усилитель": "equipment",
    "automation-автоматизация": "daw",
    "autotune": "effects",
    "bandpass-filter-пропускающий-фильтр": "mixing",
    "bit-depth-битность": "physics",
    "bitcrush-биткраш": "effects",
    "bpm-beats-per-minute": "theory",
    "bus-шина": "mixing",
    "cdquality": "physics",
    "cent-цент": "theory",
    "chorus-хорус": "effects",
    "clip-клип": "daw",
    "compressor-компрессор": "mixing",
    "daw-digital-audio-workstation": "daw",
    "delay-задержка": "mixing",
    "detune-детюн": "effects",
    "distortion-дисторшн": "effects",
    "eq-equalizer-эквалайзер": "mixing",
    "expander-экспандер": "mixing",
    "fade": "daw",
    "flanger-фленджер": "effects",
    "formant-формант": "theory",
    "frequency-частота": "physics",
    "fuzz-фаззер": "effects",
    "gain": "physics",
    "gain-staging": "mixing",
    "granular-гранулярный-синтез": "effects",
    "grid-сетка": "daw",
    "groove": "theory",
    "harmonizer-гармонизатор": "effects",
    "headroom": "physics",
    "highpass-filter-hpf": "mixing",
    "hihat-хайхэт": "equipment",
    "impulse-response-ir": "mixing",
    "insert": "mixing",
    "latency-латентность": "physics",
    "lfo-lowfrequency-oscillator-низкочастотный-осциллятор": "effects",
    "limiter-лимитер": "mixing",
    "lpf-lowpass-filter-низкочастотный-фильтр": "mixing",
    "lufs-loudness-units-full-scale": "physics",
    "mastering-мастеринг": "mixing",
    "midi-musical-instrument-digital-interface": "daw",
    "mix-микс": "mixing",
    "mixing-сведение": "mixing",
    "monitor-монитор": "equipment",
    "multieffects-мультиэффекты": "effects",
    "noise-gate-нойзгейт": "mixing",
    "overdrive-овердрайв": "effects",
    "panning-панорамирование": "mixing",
    "phaser-фейзер": "effects",
    "pitch-shifter-пичшифтер": "effects",
    "pitch-питч": "theory",
    "plosive-плозив": "effects",
    "plugin-плагин": "daw",
    "preamp-предусилитель": "equipment",
    "retune-speed": "effects",
    "reverb-реверберация": "mixing",
    "ring-modulator-рингмодулятор": "effects",
    "sample-rate-частота-дискретизации": "physics",
    "saturation-сатурация": "mixing",
    "sibilants-сибилянты": "effects",
    "sidechain-сайдчейн": "mixing",
    "spectral-denoise": "effects",
    "spectrum-спектр": "physics",
    "stereo-стерео": "physics",
    "stutter-статтер": "effects",
    "time-signature-временная-подпись": "theory",
    "timestretching-таймстретчинг": "effects",
    "track-трек": "daw",
    "transient-транзиент": "mixing",
    "tremolo-тремоло": "effects",
    "true-peak": "physics",
    "vibrato-вибрато": "effects",
    "volume-громкость": "physics",
    "vst-virtual-studio-technology": "daw",
    "warp--elastic-audio": "effects",
    "waveform-форма-волны": "physics",
    "амплитуда-amplitude": "physics",
    "аналоговый-звук": "physics",
    "аудиоинтерфейс": "equipment",
}

CATEGORY_LABELS = {
    "theory": "Теория музыки",
    "physics": "Физика звука",
    "mixing": "Сведение и мастеринг",
    "effects": "Эффекты и синтез",
    "equipment": "Оборудование",
    "daw": "DAW и продакшн",
}

# Бейдж, который on_page_markdown вставляет после термина — парсер его вырезает.
_BADGE_RE = re.compile(r'<span class="gl-badge[^>]*>[^<]*</span>\s*')


def _slugify(term):
    """Slug для якоря/ключа: латиница+кириллица+цифры, пробелы -> дефисы."""
    return re.sub(r'[^a-zа-яё0-9\s]', '', term.lower()).strip().replace(' ', '-')


def extract_glossary(md_path):
    """Parse glossary.md and extract terms with definitions and links."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Убираем бейджи категорий (вставленные on_page_markdown), чтобы парсер
    # работал одинаково на «сыром» и «обогащённом» markdown.
    content = _BADGE_RE.sub('', content)

    terms = []

    # Split by sections (## A, ## B, etc.)
    sections = re.split(r'^##\s+[A-Z]', content, flags=re.MULTILINE)

    for section in sections:
        # Match bold terms with definitions
        # Format: **Term** — definition or **Term** - definition
        pattern = r'\*\*([^*]+)\*\*\s*[-–—]\s*(.+?)(?=\n\n|\n##|\*\*|$)'
        matches = re.findall(pattern, section, re.DOTALL)

        for term_raw, def_raw in matches:
            term = term_raw.strip()
            definition = re.sub(r'\n', ' ', def_raw.strip())
            definition = re.sub(r'\s+', ' ', definition)

            # Extract link from definition if present
            link_match = re.search(r'\[(.+?)→\]\((.+?)\)', definition)
            link_text = ""
            link_url = ""
            if link_match:
                link_text = link_match.group(1).strip()
                link_url = link_match.group(2).strip()
                # Remove the link from definition text
                definition = definition[:link_match.start()].strip()

            # Clean up definition
            definition = definition.replace('*', '').replace('_', '').strip()

            # Generate slug for anchor
            slug = _slugify(term)

            terms.append({
                "term": term,
                "definition": definition,
                "link": link_url,
                "link_text": link_text,
                "slug": slug,
                "category": GLOSSARY_CATEGORIES.get(slug),
            })

    return terms


def _inject_category_badges(markdown):
    """Вставляет бейдж категории после каждого **Термина** в glossary.md."""
    def repl(m):
        bold = m.group(1)  # **Термин** со звёздочками
        term = bold.strip('*')
        cat = GLOSSARY_CATEGORIES.get(_slugify(term))
        if not cat:
            return bold  # новый термин без категории — бейдж не ставим
        label = CATEGORY_LABELS[cat]
        return '%s <span class="gl-badge gl-cat-%s" data-cat="%s">%s</span>' % (bold, cat, cat, label)

    # Только строки, начинающиеся с **Термин** — формат записей глоссария.
    return re.sub(r'^(\*\*[^*\n]+\*\*)', repl, markdown, flags=re.MULTILINE)


def on_page_markdown(markdown, **kwargs):
    """MkDocs hook — обогащает markdown страницы глоссария бейджами категорий.

    Сигнатура с **kwargs: MkDocs 1.6 передаёт (markdown, page, config, files).
    """
    page = kwargs.get("page")
    src = getattr(getattr(page, "file", None), "src_path", "") or ""
    if not src.endswith("glossary.md"):
        return markdown
    return _inject_category_badges(markdown)


def on_post_build(config, *args, **kwargs):
    """MkDocs hook — generate glossary.json after build."""
    project_root = pathlib.Path(__file__).parent.parent
    glossary_md = project_root / "docs" / "glossary.md"

    if not glossary_md.exists():
        print("[glossary] glossary.md not found, skipping")
        return {}

    terms = extract_glossary(glossary_md)

    # Write to site_dir
    site_dir = config.site_dir
    if not site_dir:
        return {}

    output_site = pathlib.Path(site_dir).resolve()
    output_site.mkdir(parents=True, exist_ok=True)
    output_file = output_site / "glossary.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(terms, f, ensure_ascii=False, indent=2)

    print("[glossary] Generated %d glossary entries -> %s" % (len(terms), output_file))

    return {}
