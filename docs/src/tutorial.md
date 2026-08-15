# Build a reactive project tree

In this tutorial, you will render project paths, select a file from Python, and filter the tree in the
browser.

## Install the packages

```bash
pip install "spaday[examples]" spaday-trees
```

## Create the tree

Save this as `tree_app.py`:

```python
import uvicorn
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
    Tree(paths=paths, selected_paths=["README.md"])
    .bind("search", "query")
    .bind("selected_paths", "selected")
    .style(height="24rem")
)

page = element(
    "main",
    element("h1").text("Project files"),
    element("input", type="search", placeholder="Filter files…").bind(
        "value",
        "query",
        mode="two-way",
    ),
    element("button").text("Select app.py").on(
        "click",
        SetField("selected", ["src/app.py"]),
    ),
    tree,
).style(max_width="42rem", margin="2rem auto", font_family="system-ui")

app = serve(
    page,
    packages=["trees"],
    store={"query": "", "selected": ["README.md"]},
)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

Run `python tree_app.py`, then open `http://127.0.0.1:8000`. Type in the search input and use the button.
Both controls update the existing Pierre model without rebuilding the component.

Continue with [Synchronize paths, selection, and search](how-to.md), or run the polished
[complete project explorer](../../spaday_trees/example.py).
