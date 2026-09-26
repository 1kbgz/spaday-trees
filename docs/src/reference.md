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

`spaday_trees.TOKENS` lists each Python `css()` keyword, CSS custom property, and description.
`spaday_trees.TOKEN_FALLBACKS` maps those keywords to their shell CSS properties. The surface, text,
border, search, selection, scrollbar, decoration, and Git-status tokens follow the shell palette by
default. `spa_trees_min_height` has no shell fallback and defaults to `200px`.

Pierre's `--trees-*-override` properties remain supported and take priority over the package mapping.

## `package`

`spaday_trees.package` is named `trees`. It serves the self-contained Pierre wrapper bundle from
`/components/trees/cdn/index.js` when selected by `serve()`. Its `components` collection contains
`SpadayTree`; `catalog` returns the wrapper's property, event, and slot schema.
