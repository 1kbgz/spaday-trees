import json
from pathlib import Path

from spaday import ComponentPackage

from .components import SpadayTree

__version__ = "0.2.4"

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
    "spa_trees_surface": ("--spa-trees-surface", "tree background"),
    "spa_trees_surface_2": ("--spa-trees-surface-2", "hovered row background"),
    "spa_trees_text": ("--spa-trees-text", "row and search text"),
    "spa_trees_muted": ("--spa-trees-muted", "icons and secondary text"),
    "spa_trees_border": ("--spa-trees-border", "search and panel borders"),
    "spa_trees_focus": ("--spa-trees-focus", "focus and selected-row outline"),
    "spa_trees_search_surface": ("--spa-trees-search-surface", "search field background"),
    "spa_trees_search_text": ("--spa-trees-search-text", "search field text"),
    "spa_trees_scrollbar": ("--spa-trees-scrollbar", "scrollbar thumb"),
    "spa_trees_selection_surface": ("--spa-trees-selection-surface", "selected row background"),
    "spa_trees_selection_text": ("--spa-trees-selection-text", "selected row text"),
    "spa_trees_git_added": ("--spa-trees-git-added", "added path status"),
    "spa_trees_git_deleted": ("--spa-trees-git-deleted", "deleted path status"),
    "spa_trees_git_ignored": ("--spa-trees-git-ignored", "ignored path status"),
    "spa_trees_git_modified": ("--spa-trees-git-modified", "modified path status and directory indicator"),
    "spa_trees_git_renamed": ("--spa-trees-git-renamed", "renamed path status"),
    "spa_trees_git_untracked": ("--spa-trees-git-untracked", "untracked path status"),
    "spa_trees_tone_info": ("--spa-trees-tone-info", "info decoration tone"),
    "spa_trees_tone_success": ("--spa-trees-tone-success", "success decoration tone"),
    "spa_trees_tone_warning": ("--spa-trees-tone-warning", "warning decoration tone"),
    "spa_trees_tone_danger": ("--spa-trees-tone-danger", "danger decoration tone"),
    "spa_trees_tone_muted": ("--spa-trees-tone-muted", "muted decoration tone"),
    "spa_trees_min_height": ("--spa-trees-min-height", "height floor for the virtualized list (default 200px)"),
}

#: ``TOKENS`` kwarg → shell CSS property used when the package token is unset.
TOKEN_FALLBACKS = {
    "spa_trees_surface": "--spa-surface",
    "spa_trees_surface_2": "--spa-surface-2",
    "spa_trees_text": "--spa-muted",
    "spa_trees_muted": "--spa-muted",
    "spa_trees_border": "--spa-border",
    "spa_trees_focus": "--spa-accent",
    "spa_trees_search_surface": "--spa-surface",
    "spa_trees_search_text": "--spa-muted",
    "spa_trees_scrollbar": "--spa-muted",
    "spa_trees_selection_surface": "--spa-accent",
    "spa_trees_selection_text": "--spa-surface",
    "spa_trees_git_added": "--spa-success",
    "spa_trees_git_deleted": "--spa-danger",
    "spa_trees_git_ignored": "--spa-muted",
    "spa_trees_git_modified": "--spa-info",
    "spa_trees_git_renamed": "--spa-warning",
    "spa_trees_git_untracked": "--spa-success",
    "spa_trees_tone_info": "--spa-info",
    "spa_trees_tone_success": "--spa-success",
    "spa_trees_tone_warning": "--spa-warning",
    "spa_trees_tone_danger": "--spa-danger",
    "spa_trees_tone_muted": "--spa-muted",
}

__all__ = ["TOKENS", "TOKEN_FALLBACKS", "SpadayTree", "Tree", "package"]
