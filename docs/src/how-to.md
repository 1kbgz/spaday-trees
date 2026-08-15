# How to synchronize paths, selection, and search

## Replace paths from application state

Bind the `paths` property to a store field:

```python
tree = Tree().bind("paths", "project.paths")
```

When the field changes, the wrapper calls Pierre's `resetPaths()`, reapplies selection, and preserves
expanded directories that still exist. Reassigning an identical path list is a no-op.

## Apply selection and search

Both properties accept programmatic updates:

```python
tree = (
    Tree(paths=paths)
    .bind("selected_paths", "project.selected_paths")
    .bind("search", "project.search")
)
```

The wrapper ignores unchanged values and suppresses matching change events while applying new ones. This
prevents a full server snapshot from resetting browser interaction state or echoing back as a new user edit.
Programmatic selection also expands its ancestor directories and scrolls the first selected path into view.

## Handle browser events

Selection events contain `{paths: string[]}` and search events contain `{value: string | null}`. A spaday
endpoint action can send either payload to Python:

```python
from spaday import CallEndpoint, event_value

tree = (
    Tree(paths=paths)
    .on(
        "selection-change",
        CallEndpoint("POST", "/api/selection", event_value()),
    )
    .on(
        "search-change",
        CallEndpoint("POST", "/api/search", event_value()),
    )
)
```

## Display Git status

Pass Pierre-compatible path and status records:

```python
Tree(
    paths=paths,
    git_status=[
        {"path": "README.md", "status": "modified"},
        {"path": "src/new.py", "status": "untracked"},
    ],
)
```

Supported statuses are `added`, `deleted`, `ignored`, `modified`, `renamed`, and `untracked`.
