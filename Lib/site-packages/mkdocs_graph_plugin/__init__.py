"""MkDocs Network Graph Plugin - Interactive graph visualization for MkDocs."""

try:
    from ._version import __version__
except ImportError:
    # Fallback for development installations without setuptools-scm
    try:
        from importlib.metadata import version

        __version__ = version("mkdocs-network-graph-plugin")
    except ImportError:
        __version__ = "unknown"
