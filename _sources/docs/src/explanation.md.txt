# Why Trees uses an imperative wrapper

Pierre Trees owns a virtualized, interactive model rather than exposing a declarative custom-element API.
Its `FileTree` class controls expansion, keyboard navigation, selection, search, rendering, and cleanup.

`spaday-trees` places that model behind `<spaday-tree>` and defines a small serializable boundary:

- Python sends flat paths, selected paths, search text, and Git status;
- the wrapper applies those values to the existing Pierre model;
- browser edits return as path-based custom events.

This keeps rapid expansion and navigation local to the browser. Replacing a component tree for every
interaction would discard internal state and add unnecessary serialization work. The wrapper instead
creates one model on connection and cleans it up when disconnected.

Paths are the shared identity. They are useful to both Python applications and Pierre, avoid a parallel
opaque identifier system, and make server reconciliation straightforward. Programmatic update guards are
part of that boundary: without them, applying server state could produce a feedback loop of identical
browser events.
