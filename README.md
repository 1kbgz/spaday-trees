# spaday-trees

[Trees, by Pierre](https://trees.software/docs), for [spaday](https://1kbgz.github.io/spaday/)

[![Build Status](https://github.com/1kbgz/spaday-trees/actions/workflows/build.yaml/badge.svg?branch=main&event=push)](https://github.com/1kbgz/spaday-trees/actions/workflows/build.yaml)
[![codecov](https://codecov.io/gh/1kbgz/spaday-trees/branch/main/graph/badge.svg)](https://codecov.io/gh/1kbgz/spaday-trees)
[![License](https://img.shields.io/github/license/1kbgz/spaday-trees)](https://github.com/1kbgz/spaday-trees)
[![PyPI](https://img.shields.io/pypi/v/spaday-trees.svg)](https://pypi.python.org/pypi/spaday-trees)

## Overview

`spaday-trees` wraps Pierre's imperative `FileTree` in a `<spaday-tree>` custom element and exposes it
as the Python `Tree` component. The first release supports reactive path replacement, selected paths,
search, Git status, and path-based `selection-change` / `search-change` events.

## Interactive example

This app filters the tree as you type. The button changes its selected path through spaday's reactive
store; selecting and expanding nodes in the tree remains client-side.

```python
from spaday import SetField, element
from spaday.backends.starlette import serve
from spaday_trees import Tree

paths = [
    "README.md",
    "pyproject.toml",
    "src/app.py",
    "src/components/tree.py",
    "tests/test_app.py",
]

tree = (
    Tree(paths=paths)
    .bind("search", "query")
    .bind("selected_paths", "selected")
    .style(height="22rem")
)

page = (
    element("main")
    .style(max_width="42rem", margin="2rem auto", font_family="system-ui")
    .child(element("h1").text("Project files"))
    .child(
        element("input", type="search", placeholder="Filter files…")
        .bind("value", "query", mode="two-way")
        .style(width="100%", padding="0.6rem", margin_bottom="0.75rem")
    )
    .child(element("button").text("Select README").on("click", SetField("selected", ["README.md"])))
    .child(tree)
)

app = serve(page, packages=["trees"], store={"query": "", "selected": []})
```

Save this as `app.py`, then run `pip install spaday-trees starlette uvicorn` and
`uvicorn app:app`. Open <http://127.0.0.1:8000>.

Installing this project registers the `trees` entry point with spaday. The equivalent explicit forms
are `packages=[spaday_trees.package]` and `packages=["spaday_trees:package"]`.

The integration pins `@pierre/trees` `1.0.0-beta.5`. Rename, drag-and-drop persistence, custom
composition renderers, and SSR/hydration are intentionally deferred while its beta API settles.

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).
