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

## `package`

`spaday_trees.package` is named `trees`. It serves the self-contained Pierre wrapper bundle from
`/components/trees/cdn/index.js` when selected by `serve()`. Its `components` collection contains
`SpadayTree`; `catalog` returns the wrapper's property, event, and slot schema.
