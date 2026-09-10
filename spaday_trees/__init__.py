from pathlib import Path

from spaday import ComponentPackage

from .components import SpadayTree

__version__ = "0.2.4"

package = ComponentPackage(
    name="trees",
    assets_dir=Path(__file__).parent / "extension",
    assets=(("css", "css/index.css"), ("js", "cdn/index.js")),
    components=(SpadayTree,),
)

Tree = SpadayTree

#: ``css()`` kwarg → (CSS custom property, what it controls), in the shape of
#: :data:`spaday.theme.SHELL_TOKENS`.
#:
#: Decoration tones default to the shell tone they belong to, so re-theming the shell carries the
#: tree with it; set these to theme the tree alone::
#:
#:     Tree(...).css(spa_trees_tone_danger="#FC6B47")
#:
#: The older ``--trees-tone-*`` spelling still works as an alias. Everything else about the tree's
#: appearance belongs to the Pierre engine and is set through *its* ``--trees-*`` tokens
#: (``--trees-accent``, ``--trees-bg``, …), which this package deliberately does not wrap.
TOKENS = {
    "spa_trees_tone_info": ("--spa-trees-tone-info", "info decoration tone (defaults to --spa-info)"),
    "spa_trees_tone_success": ("--spa-trees-tone-success", "success decoration tone (defaults to --spa-success)"),
    "spa_trees_tone_warning": ("--spa-trees-tone-warning", "warning decoration tone (defaults to --spa-warning)"),
    "spa_trees_tone_danger": ("--spa-trees-tone-danger", "danger decoration tone (defaults to --spa-danger)"),
    "spa_trees_tone_muted": ("--spa-trees-tone-muted", "muted decoration tone (defaults to --spa-muted)"),
    "spa_trees_min_height": ("--spa-trees-min-height", "height floor for the virtualized list (default 200px)"),
}

__all__ = ["TOKENS", "SpadayTree", "Tree", "package"]
