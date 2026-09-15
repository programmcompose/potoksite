# -*- coding: utf-8 -*-
"""Replace ```mermaid blocks in docs/*.md with animated workflow components."""
import re, importlib.util

spec = importlib.util.spec_from_file_location("gen", r"C:/Users/IYBETOS/potoksite/_gen_workflow.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)  # safe: injection loop is under __main__ guard

DOCS = r"C:/Users/IYBETOS/potoksite/docs"
MERMAID_MD_RE = re.compile(r"^```mermaid\n.*?^```\s*$", re.S | re.M)

for md_rel, components in gen.docs_replacements().items():
    path = DOCS + "/" + md_rel
    text = open(path, encoding="utf-8").read()
    blocks = MERMAID_MD_RE.findall(text)
    if not blocks:
        print("SKIP %-45s already patched" % md_rel); continue
    assert len(blocks) == len(components), \
        "%s: %d mermaid block(s) but %d component(s)" % (md_rel, len(blocks), len(components))
    for comp in components:
        assert "\n\n" not in comp, "blank line inside HTML block would break markdown parsing"
    state = [0]
    def sub(mobj):
        r = components[state[0]]; state[0] += 1; return r
    text2 = MERMAID_MD_RE.sub(sub, text)
    assert state[0] == len(components)
    open(path, "w", encoding="utf-8").write(text2)
    print("OK %-45s replaced %d mermaid block(s)" % (md_rel, len(blocks)))
