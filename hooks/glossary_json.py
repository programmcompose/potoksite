import json
import os
import re
import pathlib


def extract_glossary(md_path):
    """Parse glossary.md and extract terms with definitions and links."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

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
            slug = re.sub(r'[^a-zа-яё0-9\s]', '', term.lower()).strip().replace(' ', '-')

            terms.append({
                "term": term,
                "definition": definition,
                "link": link_url,
                "link_text": link_text,
                "slug": slug,
            })

    return terms


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
