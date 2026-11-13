# API reference

## `Tree`

`Tree` is the preferred alias for `SpadayTree`. Tag: `<spaday-tree>`.

| Prop             | Type            | Description                                |
| ---------------- | --------------- | ------------------------------------------ |
| `paths`          | `list[str]`     | Complete flat list of file paths.          |
| `selected_paths` | `list[str]`     | Paths selected in the current model.       |
| `search`         | `str \| None`   | Current search query.                      |
| `git_status`     | list of mapping | Pierre-compatible path and status entries. |

```{eval-rst}
.. autoclass:: spaday_trees.SpadayTree
   :members:
```

## Events

| Event              | Detail                 |
| ------------------ | ---------------------- |
| `selection-change` | `{paths: list[str]}`   |
| `search-change`    | `{value: str \| None}` |

Programmatic selection and search assignments do not emit matching events.
Programmatic selection expands ancestor directories and scrolls the first selected path into view.

Path replacement preserves expanded directories that exist in both path sets. Assigning an unchanged
path list does not rebuild the Pierre model.

## Theme tokens

`spaday_trees.TOKENS` maps each Python `css()` keyword to a `spaday.Token` containing its CSS custom
property, description, and optional shell fallback. The surface, text, border, search, selection,
scrollbar, decoration, and Git-status tokens follow the shell palette by default.
`spa_trees_min_height` has no shell fallback and defaults to `200px`.

Pierre's `--trees-*-override` properties remain supported and take priority over the package mapping.

## `package`

`spaday_trees.package` is named `trees`. It serves the self-contained Pierre wrapper bundle from
`/components/trees/cdn/index.js` when selected by `serve()`. Its `components` collection contains
`SpadayTree`; `catalog` returns the wrapper's property, event, and slot schema.

## Item geometry

The browser element exposes `getItemAtPoint(x, y)`, returning a visible item path at viewport CSS
coordinates, or `undefined` over a header, covered item, or outside the tree.
`getItemBounds(path)` returns `{bounds, visibleBounds}` as `DOMRect` values for a rendered item.
`visibleBounds` intersects the row with scrolling ancestors and the browser viewport. Hidden or
unrendered paths return `undefined`. Neither method changes selection, expansion, or scroll position.

`viewport-change` bubbles across shadow boundaries after internal scroll, rendered-row changes, or
viewport resizing, coalesced per animation frame. Consumers recalculate geometry in response and
observe their own surrounding page layout. The collaboration example uses these APIs for overlays;
applications do not need access to Pierre's shadow DOM.
