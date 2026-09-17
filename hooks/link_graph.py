"""
MkDocs hook — builds link graph for backlinks + hover previews.

Outputs into site_dir:
  link-graph.json  — { pages: {...}, backlinks: { target_url: [sources...] } }

Usage in mkdocs.yml:
  hooks:
    - hooks/glossary_json.py
    - hooks/link_graph.py
"""

from __future__ import annotations

import json
import pathlib
import re
from typing import Any
from urllib.parse import unquote, urlparse


# [text](url) — ignore images ![
MD_LINK_RE = re.compile(
    r"(?<!!)"  # not image
    r"\[([^\]]*)\]\(([^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\)"
)

# optional [[wikilink]] / [[path|alias]]
WIKI_LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")

FRONT_MATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
MD_EMPHASIS_RE = re.compile(r"[*_`#]+")


def strip_front_matter(text: str) -> str:
    return FRONT_MATTER_RE.sub("", text, count=1)


def first_heading(text: str) -> str | None:
    m = HEADING_RE.search(text)
    if not m:
        return None
    return clean_inline(m.group(1))


def clean_inline(s: str) -> str:
    s = HTML_TAG_RE.sub("", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = MD_EMPHASIS_RE.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def excerpt_from(text: str, max_len: int = 180) -> str:
    body = strip_front_matter(text)
    # drop headings and code fences roughly
    lines = []
    in_code = False
    for line in body.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if line.startswith("#"):
            continue
        if line.strip().startswith("!!!"):
            continue
        if line.strip().startswith("|"):
            continue
        if line.strip().startswith("- [ ]") or line.strip().startswith("- [x]"):
            continue
        lines.append(line)
    plain = " ".join(lines)
    plain = HTML_TAG_RE.sub(" ", plain)
    plain = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", plain)
    plain = re.sub(r"[*_`>~]+", "", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) <= max_len:
        return plain
    cut = plain[: max_len - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut + "…"


def md_path_to_url(rel_md: pathlib.Path) -> str:
    """docs/etap2/eq.md -> etap2/eq/  (MkDocs pretty URLs style)"""
    parts = rel_md.as_posix()
    if parts.endswith("index.md"):
        base = parts[: -len("index.md")]
    elif parts.endswith(".md"):
        base = parts[: -3] + "/"
    else:
        base = parts
    # normalize
    base = base.lstrip("./")
    if not base.endswith("/") and base:
        # file.md -> file/
        if not base.endswith("/"):
            base = base if base.endswith("/") else (base + "/" if not base.endswith(".html") else base)
    if base == "/" or base == "":
        return "."
    return base


def normalize_target(url: str, from_dir: pathlib.Path, docs_dir: pathlib.Path) -> str | None:
    """Resolve relative markdown link to site URL key, or None if external/skip."""
    url = url.strip()
    if not url or url.startswith("#"):
        return None
    if url.startswith("mailto:") or url.startswith("tel:"):
        return None
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https", "ftp"):
        return None
    # drop query/fragment for graph key
    path = unquote(parsed.path or "")
    if not path:
        return None
    if path.startswith("/"):
        # site-absolute from root of site
        path = path.lstrip("/")
        if path.endswith(".md"):
            path = path[:-3] + "/"
        elif path and not path.endswith("/") and "." not in pathlib.Path(path).name:
            path = path + "/"
        if path.endswith("index.html"):
            path = path[: -len("index.html")]
        elif path.endswith(".html"):
            path = path[: -5] + "/"
        return path or "."

    # relative to current file directory
    resolved = (from_dir / path).resolve()
    try:
        rel = resolved.relative_to(docs_dir.resolve())
    except ValueError:
        return None

    if rel.suffix == ".md":
        return md_path_to_url(rel)
    if rel.suffix == ".html":
        s = rel.as_posix()
        if s.endswith("index.html"):
            return s[: -len("index.html")] or "."
        return s[: -5] + "/"
    # directory-ish
    s = rel.as_posix()
    if not s.endswith("/"):
        s += "/"
    return s


def extract_links(md_text: str, from_file: pathlib.Path, docs_dir: pathlib.Path) -> list[str]:
    from_dir = from_file.parent
    found: list[str] = []
    seen: set[str] = set()

    for _text, href in MD_LINK_RE.findall(md_text):
        key = normalize_target(href, from_dir, docs_dir)
        if key and key not in seen:
            seen.add(key)
            found.append(key)

    for wiki in WIKI_LINK_RE.findall(md_text):
        # [[page]] or [[page|alias]] or [[folder/page]]
        target = wiki.split("|", 1)[0].strip()
        if not target:
            continue
        # treat as relative .md path
        if not target.endswith(".md"):
            candidate = target + ".md"
        else:
            candidate = target
        key = normalize_target(candidate, from_dir, docs_dir)
        if key and key not in seen:
            seen.add(key)
            found.append(key)

    return found


def is_excluded(rel_posix: str, spec) -> bool:
    """True if the docs-relative path matches mkdocs.yml `exclude_docs` (GitIgnoreSpec)."""
    if spec is None:
        return False
    try:
        return spec.match_file(rel_posix)
    except Exception:
        return False


def collect_pages(docs_dir: pathlib.Path, exclude_spec=None) -> dict[str, Any]:
    pages: dict[str, Any] = {}
    outlinks: dict[str, list[str]] = {}

    for md in sorted(docs_dir.rglob("*.md")):
        if any(p.startswith(".") for p in md.parts):
            continue
        try:
            rel = md.relative_to(docs_dir)
        except ValueError:
            continue
        if is_excluded(rel.as_posix(), exclude_spec):
            continue
        url = md_path_to_url(rel)
        try:
            text = md.read_text(encoding="utf-8")
        except OSError:
            continue

        title = first_heading(text) or rel.stem.replace("-", " ")
        excerpt = excerpt_from(text)
        links = extract_links(text, md, docs_dir)

        pages[url] = {
            "title": title,
            "excerpt": excerpt,
            "path": rel.as_posix(),
        }
        outlinks[url] = links

    # invert to backlinks
    backlinks: dict[str, list[dict[str, str]]] = {}
    for src, targets in outlinks.items():
        src_meta = pages.get(src, {})
        for t in targets:
            if t not in pages and t != ".":
                # still record if we know nothing — skip orphans optional
                continue
            entry = {
                "url": src,
                "title": src_meta.get("title") or src,
            }
            backlinks.setdefault(t, [])
            # dedupe
            if not any(e["url"] == src for e in backlinks[t]):
                backlinks[t].append(entry)

    # stable sort
    for t in backlinks:
        backlinks[t].sort(key=lambda e: e["title"].lower())

    return {
        "pages": pages,
        "outlinks": outlinks,
        "backlinks": backlinks,
    }


def on_post_build(config, *args, **kwargs):
    docs_dir = pathlib.Path(config.docs_dir).resolve()
    site_dir = pathlib.Path(config.site_dir).resolve()
    site_dir.mkdir(parents=True, exist_ok=True)

    graph = collect_pages(docs_dir, getattr(config, "exclude_docs", None))
    out = site_dir / "link-graph.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)

    n_pages = len(graph["pages"])
    n_bl = sum(len(v) for v in graph["backlinks"].values())
    print(f"[link-graph] {n_pages} pages, {n_bl} backlink edges -> {out}")
    return {}
