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

## Edit shared records

Install the example dependencies and start the [collaborative example](../../spaday_trees/collaboration.py):

```bash
python -m pip install -e ".[examples]"
python -m spaday_trees.collaboration
```

Open `http://127.0.0.1:8043` as Alice, `/bob` in another tab, and `/viewer` for read-only access.
Edit a title as Alice and its note as Bob: both fields converge in all three tabs. Select a different
record as Bob to verify that selection stays local. Delete `docs/README.md` to remove that record
from every tab while keeping `src/README.md` and its edits.

To adapt this example:

- Keep a stable, unique `id` on each record. Declare `records` as a CRDT keyed set and `details` as a
  nested map. Set iteration order is not a record identity or a persisted display order.
- Render editors with `Each(..., field="board.records", key="id")`. Bind inputs to `item("title")`
  and `item("details.note")` in two-way mode. These writes target the record identity after another
  record is deleted or the collection order changes.
- Keep selection in the page's local `store`, outside the `board` wire namespace.
- Apply deletion on the server using the submitted ID and a fresh CRDT snapshot. Diff that snapshot
  and pass its operations to `hub.mutate_shared_crdt()`. A repeated deletion returns 404.
- Grant `WRITE` only to editors on the Hub and check the same role in the HTTP deletion endpoint.
  Replace URL-selected demo roles with authenticated identities before deployment.

`Wire(reconnect=True)` replays queued field edits after a temporary disconnect. To try this, take
Alice's tab offline, edit its title, change Bob's note, then reconnect Alice. Both changes should
appear. Deletion uses an HTTP request and requires a connection; it is not queued offline.
The example keeps data in memory, so restarting the server resets it.

Keep full file paths as record IDs, so identical filenames in different directories remain distinct.
`Tree.paths` receives a path projection from the shared records; the deletion endpoint updates both
in one CRDT mutation. Selection binds through `selected_paths` and `selection-change`. The metadata
form edits titles and notes; this example does not rename files or persist drag-and-drop moves.
