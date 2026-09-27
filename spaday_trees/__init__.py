import json
from pathlib import Path

from spaday import ComponentPackage, Token

from .components import SpadayTree

__version__ = "0.3.0"

# the exact version of each JS library the package serves, written by its JS build
_VERSIONS = Path(__file__).parent / "extension" / "versions.json"

package = ComponentPackage(
    name="trees",
    assets_dir=Path(__file__).parent / "extension",
    assets=(("css", "css/index.css"), ("js", "cdn/index.js")),
    components=(SpadayTree,),
    provides=json.loads(_VERSIONS.read_text(encoding="utf-8")) if _VERSIONS.exists() else {},
)

Tree = SpadayTree

#: ``css()`` kwarg → (CSS custom property, what it controls).
#:
#: Decoration tones default to the shell tone they belong to, so re-theming the shell carries the
#: tree with it; set these to theme the tree alone::
#:
#:     Tree(...).css(spa_trees_tone_danger="#FC6B47")
#:
#: The older ``--trees-tone-*`` and Pierre ``--trees-*-override`` spellings still work as aliases.
TOKENS = {
    "spa_trees_surface": Token("--spa-trees-surface", "tree background", fallback="--spa-surface"),
    "spa_trees_surface_2": Token("--spa-trees-surface-2", "hovered row background", fallback="--spa-surface-2"),
    "spa_trees_text": Token("--spa-trees-text", "row and search text", fallback="--spa-text"),
    "spa_trees_muted": Token("--spa-trees-muted", "icons and secondary text", fallback="--spa-muted"),
    "spa_trees_border": Token("--spa-trees-border", "search and panel borders", fallback="--spa-border"),
    "spa_trees_focus": Token("--spa-trees-focus", "focus and selected-row outline", fallback="--spa-accent"),
    "spa_trees_search_surface": Token("--spa-trees-search-surface", "search field background", fallback="--spa-surface"),
    "spa_trees_search_text": Token("--spa-trees-search-text", "search field text", fallback="--spa-text"),
    "spa_trees_scrollbar": Token("--spa-trees-scrollbar", "scrollbar thumb", fallback="--spa-muted"),
    "spa_trees_selection_surface": Token("--spa-trees-selection-surface", "selected row background", fallback="--spa-accent"),
    "spa_trees_selection_text": Token("--spa-trees-selection-text", "selected row text", fallback="--spa-surface"),
    "spa_trees_git_added": Token("--spa-trees-git-added", "added path status", fallback="--spa-success"),
    "spa_trees_git_deleted": Token("--spa-trees-git-deleted", "deleted path status", fallback="--spa-danger"),
    "spa_trees_git_ignored": Token("--spa-trees-git-ignored", "ignored path status", fallback="--spa-muted"),
    "spa_trees_git_modified": Token("--spa-trees-git-modified", "modified path status and directory indicator", fallback="--spa-info"),
    "spa_trees_git_renamed": Token("--spa-trees-git-renamed", "renamed path status", fallback="--spa-warning"),
    "spa_trees_git_untracked": Token("--spa-trees-git-untracked", "untracked path status", fallback="--spa-success"),
    "spa_trees_tone_info": Token("--spa-trees-tone-info", "info decoration tone", fallback="--spa-info"),
    "spa_trees_tone_success": Token("--spa-trees-tone-success", "success decoration tone", fallback="--spa-success"),
    "spa_trees_tone_warning": Token("--spa-trees-tone-warning", "warning decoration tone", fallback="--spa-warning"),
    "spa_trees_tone_danger": Token("--spa-trees-tone-danger", "danger decoration tone", fallback="--spa-danger"),
    "spa_trees_tone_muted": Token("--spa-trees-tone-muted", "muted decoration tone", fallback="--spa-muted"),
    "spa_trees_min_height": Token("--spa-trees-min-height", "height floor for the virtualized list (default 200px)"),
}

__all__ = ["TOKENS", "SpadayTree", "Tree", "package"]
