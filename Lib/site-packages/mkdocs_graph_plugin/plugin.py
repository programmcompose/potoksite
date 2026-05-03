"""MkDocs Network Graph Plugin - Interactive graph visualization for MkDocs."""

import json
import os
import shutil
from urllib.parse import urlparse

from mkdocs.config.config_options import Choice, Type
from mkdocs.config.defaults import MkDocsConfig
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.structure.files import Files
from mkdocs.structure.nav import Navigation as Nav

from .graph import Graph

log = get_plugin_logger(__name__)


class GraphPlugin(BasePlugin):
    """MkDocs plugin for generating interactive graph visualizations."""

    config_scheme = (
        ("name", Choice(("title", "file_name"), default="title")),
        ("debug", Type(bool, default=False)),
    )

    def on_config(self, config: MkDocsConfig) -> MkDocsConfig:
        """Define the static assets to be injected."""
        log.info("Configuring graph plugin")
        self.static_dir = os.path.join(os.path.dirname(__file__), "static")

        config["extra_javascript"].append("https://d3js.org/d3.v7.min.js")

        # Correctly inject the plugin's static assets
        if "js/graph.js" not in config["extra_javascript"]:
            config["extra_javascript"].append("js/graph.js")

        if "css/graph.css" not in config["extra_css"]:
            config["extra_css"].append("css/graph.css")

        return config

    def on_pre_build(self, *, config, **kwargs):
        """Initialize the graph data structure."""
        log.info("Initializing graph data structure")
        self._graph = Graph(self.config)

    def on_nav(self, nav: Nav, *, config: MkDocsConfig, files: Files) -> Nav:
        """Store the files collection for later use."""
        log.info("Storing file collection")
        self._files = files
        return nav

    def _write_graph_file(self, config):
        """Write the graph data to a file."""
        log.info("Writing graph data to file...")
        output_dir = os.path.join(config["site_dir"], "graph")
        try:
            os.makedirs(output_dir, exist_ok=True)
            graph_file = os.path.join(output_dir, "graph.json")
            with open(graph_file, "w") as f:
                json.dump(self._graph.to_dict(), f)
        except (IOError, OSError) as e:
            log.error(f"Error writing graph file: {e}")

    def on_post_page(self, output: str, *, page, config) -> str:
        """Inject the graph options script into the HTML page."""
        site_url = config.get("site_url")
        if site_url:
            base_path = urlparse(site_url).path
            # Ensure base_path ends with a slash
            if not base_path.endswith("/"):
                base_path += "/"
        else:
            base_path = "/"

        options_script = (
            "<script>"
            f"window.graph_options = {{"
            f"    debug: {str(self.config['debug']).lower()},"
            f"    base_path: '{base_path}'"
            f"}};"
            "</script>"
        )
        if "</body>" in output:
            return output.replace("</body>", f"{options_script}</body>")
        return output

    def on_post_build(self, *, config, **kwargs):
        """Output the graph data and copy static assets."""
        log.info("Starting on_post_build event")
        self._graph(self._files)
        self._write_graph_file(config)

        # Copy static assets to the site_dir
        # This is the correct way to include plugin assets
        log.info("Copying static assets...")
        try:
            # Copy JS
            js_output_dir = os.path.join(config["site_dir"], "js")
            os.makedirs(js_output_dir, exist_ok=True)
            shutil.copy(os.path.join(self.static_dir, "graph.js"), js_output_dir)

            # Copy CSS
            css_output_dir = os.path.join(config["site_dir"], "css")
            os.makedirs(css_output_dir, exist_ok=True)
            shutil.copy(os.path.join(self.static_dir, "graph.css"), css_output_dir)
        except (IOError, OSError) as e:
            log.error(f"Error copying static assets: {e}")
