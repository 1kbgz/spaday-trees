# spaday-trees

[Trees, by Pierre](https://trees.software/docs), for [spaday](https://1kbgz.github.io/spaday/)

[![Build Status](https://github.com/1kbgz/spaday-trees/actions/workflows/build.yaml/badge.svg?branch=main&event=push)](https://github.com/1kbgz/spaday-trees/actions/workflows/build.yaml)
[![codecov](https://codecov.io/gh/1kbgz/spaday-trees/branch/main/graph/badge.svg)](https://codecov.io/gh/1kbgz/spaday-trees)
[![License](https://img.shields.io/github/license/1kbgz/spaday-trees)](https://github.com/1kbgz/spaday-trees)
[![PyPI](https://img.shields.io/pypi/v/spaday-trees.svg)](https://pypi.python.org/pypi/spaday-trees)

## Overview

> [!NOTE]
> This library was generated using [copier](https://copier.readthedocs.io/en/stable/) from the [Base Python Project Template repository](https://github.com/python-project-templates/base).

`spaday-trees` wraps Pierre's imperative `FileTree` in a `<spaday-tree>` custom element and exposes it
as the Python `Tree` component. The first release supports reactive path replacement, selected paths,
search, Git status, and path-based `selection-change` / `search-change` events.

```python
from spaday.backends.starlette import serve
from spaday_trees import Tree

page = Tree(
    paths=["src/index.ts", "src/app.py", "README.md"],
    selected_paths=["src/app.py"],
)

app = serve(page, packages=["trees"])
```

Installing this project registers the `trees` entry point with spaday. The equivalent explicit forms
are `packages=[spaday_trees.package]` and `packages=["spaday_trees:package"]`.

The integration pins `@pierre/trees` `1.0.0-beta.5`. Rename, drag-and-drop persistence, custom
composition renderers, and SSR/hydration are intentionally deferred while its beta API settles.
