import re
import os

NAV_ICON_PATTERN = re.compile(
    r"<span\s+class=['\"]nav-icon['\"]\s+data-lucide=['\"][^'\"]*['\"]></span>\s*"
)


def on_post_build(config):
    site_dir = config["site_dir"]
    graph_path = os.path.join(site_dir, "graph", "graph.json")
    if not os.path.isfile(graph_path):
        return

    with open(graph_path, encoding="utf-8") as f:
        data = f.read()

    cleaned = NAV_ICON_PATTERN.sub("", data)

    if cleaned != data:
        with open(graph_path, "w", encoding="utf-8") as f:
            f.write(cleaned)
