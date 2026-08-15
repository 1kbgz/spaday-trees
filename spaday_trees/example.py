import asyncio
import logging

import transports
import uvicorn
from pydantic import BaseModel, Field
from spaday import CallEndpoint, element, event_value
from spaday.backends.starlette import serve
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute

from spaday_trees import Tree, package

logger = logging.getLogger("uvicorn.error")

initial_paths = [
    ".github/workflows/build.yaml",
    ".github/workflows/docs.yaml",
    "docs/src/explanation.md",
    "docs/src/how-to.md",
    "docs/src/reference.md",
    "docs/src/tutorial.md",
    "js/src/ts/index.ts",
    "js/tests/index.spec.js",
    "spaday_trees/__init__.py",
    "spaday_trees/components.cem.json",
    "spaday_trees/components.py",
    "spaday_trees/tests/test_all.py",
    "AGENTS.md",
    "LICENSE",
    "README.md",
    "spaday_trees/example.py",
    "pyproject.toml",
]


class ProjectFeed(BaseModel):
    paths: list[str] = Field(default_factory=lambda: list(initial_paths))
    selected_paths: list[str] = Field(default_factory=lambda: ["README.md"])
    search: str = ""
    file_count: str = str(len(initial_paths))
    changed_count: str = "5"
    sync_status: str = "Connected"


feed = ProjectFeed()
session = transports.Session()
session.host(feed)
server = transports.Server(session)

git_status = [
    {"path": "README.md", "status": "modified"},
    {"path": "spaday_trees/example.py", "status": "added"},
    {"path": "docs/src/tutorial.md", "status": "modified"},
    {"path": "js/tests/index.spec.js", "status": "modified"},
    {"path": "spaday_trees/components.py", "status": "untracked"},
]


async def rotate_server_file() -> None:
    tick = 0
    generated: str | None = None
    while True:
        await asyncio.sleep(5)
        tick += 1
        paths = [path for path in feed.paths if path != generated]
        generated = f"server/review-{tick:02d}.md"
        feed.paths = [*paths, generated]
        feed.file_count = str(len(feed.paths))
        feed.sync_status = f"Server added {generated}"


async def tree_event(request):
    event_type = request.path_params["event_type"]
    payload = await request.json()
    if event_type == "selection":
        paths = [str(path) for path in payload.get("paths", [])]
        feed.selected_paths = paths
        message = f"Selected {paths[0]}" if paths else "Selection cleared"
    elif event_type == "search":
        value = str(payload.get("value") or "")
        feed.search = value
        message = f"Searching for “{value}”" if value else "Search cleared"
    else:
        return JSONResponse({"message": "Unknown tree event"}, status_code=404)
    feed.sync_status = message
    logger.info("Tree %s received from browser: %s", event_type, payload)
    return JSONResponse({"message": message})


tree = (
    Tree(
        paths=initial_paths,
        selected_paths=["README.md"],
        git_status=git_status,
        id="project-tree",
    )
    .bind("paths", "paths")
    .bind("selected_paths", "selected_paths")
    .bind("search", "search")
    .on("selection-change", CallEndpoint("POST", "/api/tree/selection", event_value(), result="tree_result"))
    .on("search-change", CallEndpoint("POST", "/api/tree/search", event_value(), result="tree_result"))
)

page = element(
    "main",
    element(
        "header",
        element(
            "div",
            element("p", class_="eyebrow").text("REACTIVE PROJECT EXPLORER"),
            element("h1").text("Pierre Trees workspace"),
            element("p", class_="lede").text("A fast file tree with search, selection, Git status, and bidirectional server sync."),
        ),
        element("div", element("span", class_="pulse"), element("strong").bind("textContent", "sync_status"), class_="connection"),
        class_="page-header",
    ),
    element(
        "section",
        element("article", element("span").text("Project files"), element("strong").bind("textContent", "file_count")),
        element("article", element("span").text("Changed files"), element("strong").bind("textContent", "changed_count")),
        element("article", element("span").text("Active branch"), element("strong").text("tkp/examples")),
        class_="metrics",
    ),
    element(
        "section",
        element(
            "aside",
            element(
                "div",
                element("span", class_="window-dot red"),
                element("span", class_="window-dot yellow"),
                element("span", class_="window-dot green"),
                class_="window-controls",
            ),
            element("div", element("strong").text("EXPLORER"), element("span").text("SPADAY-TREES"), class_="panel-title"),
            tree,
            class_="tree-panel",
        ),
        element(
            "article",
            element("span", class_="file-label").text("README.md"),
            element("h2").text("Build interfaces from typed components"),
            element("p").text("Select any item in the tree. Selection and search events return to Python and are logged by the server."),
            element(
                "div",
                element("button")
                .text("Select README")
                .on(
                    "click",
                    CallEndpoint("POST", "/api/tree/selection", {"paths": ["README.md"]}, result="tree_result"),
                ),
                element("button")
                .text("Select component")
                .on(
                    "click",
                    CallEndpoint(
                        "POST",
                        "/api/tree/selection",
                        {"paths": ["spaday_trees/components.py"]},
                        result="tree_result",
                    ),
                ),
                element("button")
                .text("Clear selection")
                .on("click", CallEndpoint("POST", "/api/tree/selection", {"paths": []}, result="tree_result")),
                class_="actions",
            ),
            element(
                "div", element("span", class_="status-dot"), element("span").bind("textContent", "tree_result.body.message"), class_="event-status"
            ),
            element(
                "div",
                element("span").text("M"),
                element("code").text("README.md"),
                element("span").text("Modified"),
                class_="change-row",
            ),
            element(
                "div",
                element("span").text("A"),
                element("code").text("spaday_trees/example.py"),
                element("span").text("Added"),
                class_="change-row added",
            ),
            class_="preview-panel",
        ),
        class_="workspace",
    ),
    element("p", class_="footnote").text(
        "The server replaces one generated file every five seconds; browser selection and search round-trip immediately."
    ),
    class_="page",
)

styles = """
<style>
  body { margin: 0; min-height: 100vh; background: #eef2f6; color: #172033; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  .page { box-sizing: border-box; max-width: 76rem; margin: 0 auto; padding: 2.75rem 1.25rem; }
  .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
  .eyebrow { margin: 0; color: #7c3aed; font-size: .72rem; font-weight: 800; letter-spacing: .16em; }
  h1 { margin: .2rem 0 0; font-size: clamp(2rem, 5vw, 3.1rem); letter-spacing: -.045em; }
  h2 { margin: .55rem 0; font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -.035em; }
  p { color: #64748b; line-height: 1.55; } .lede { margin: .45rem 0 0; }
  .connection { display: flex; align-items: center; gap: .6rem; max-width: 20rem; padding: .72rem 1rem; border: 1px solid #ddd6fe;
    border-radius: .75rem; background: #fff; color: #5b21b6; font-size: .78rem; box-shadow: 0 8px 22px rgba(15,23,42,.05); }
  .pulse, .status-dot { width: .55rem; height: .55rem; flex: 0 0 auto; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 .25rem #dcfce7; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: .85rem; margin-block: 1.6rem; }
  .metrics article { padding: 1rem 1.1rem; border: 1px solid #dbe3ed; border-radius: .85rem; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.045); }
  .metrics span { display: block; color: #64748b; font-size: .78rem; } .metrics strong { display: block; margin-top: .28rem; font-size: 1.35rem; }
  .workspace { display: grid; grid-template-columns: minmax(18rem, .75fr) minmax(0, 1.25fr); min-height: 34rem; overflow: hidden;
    border: 1px solid #cbd5e1; border-radius: 1rem; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.1); }
  .tree-panel { min-width: 0; padding: .85rem; border-right: 1px solid #e2e8f0; background: #f8fafc; }
  .window-controls { display: flex; gap: .38rem; padding: .2rem .25rem .85rem; } .window-dot { width: .68rem; height: .68rem; border-radius: 50%; }
  .red { background: #fb7185; } .yellow { background: #fbbf24; } .green { background: #34d399; }
  .panel-title { display: flex; justify-content: space-between; padding: .55rem .45rem .8rem; color: #475569; font-size: .7rem; letter-spacing: .1em; }
  #project-tree { display: block; height: 29rem; min-width: 0; border: 1px solid #e2e8f0; border-radius: .7rem; overflow: hidden; background: #fff; }
  .preview-panel { min-width: 0; padding: clamp(1.5rem, 4vw, 3.25rem); background: radial-gradient(circle at top right, #ede9fe, transparent 38%), #fff; }
  .file-label { display: inline-block; padding: .3rem .55rem; border-radius: .45rem; background: #ede9fe; color: #6d28d9; font-size: .75rem; font-weight: 800; }
  .actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-block: 1.5rem; }
  button { border: 1px solid #c4b5fd; border-radius: .58rem; padding: .62rem .82rem; background: #fff; color: #6d28d9; cursor: pointer; font: inherit; font-weight: 750; }
  button:hover { background: #f5f3ff; border-color: #7c3aed; }
  .event-status { display: flex; align-items: center; gap: .65rem; min-height: 1.3rem; margin-bottom: 1.5rem; color: #64748b; font-size: .82rem; }
  .change-row { display: grid; grid-template-columns: 1.5rem 1fr auto; gap: .7rem; align-items: center; margin-top: .55rem; padding: .72rem .85rem;
    border: 1px solid #e2e8f0; border-radius: .65rem; color: #b45309; background: rgba(255,255,255,.75); font-size: .8rem; }
  .change-row > :first-child { font-weight: 900; } .change-row.added { color: #047857; }
  code { overflow: hidden; color: #334155; text-overflow: ellipsis; }
  .footnote { margin: .75rem .2rem 0; font-size: .8rem; }
  @media (max-width: 760px) { .page { padding: 1rem .6rem; } .page-header { align-items: flex-start; flex-direction: column; }
    .metrics { grid-template-columns: 1fr; } .workspace { grid-template-columns: 1fr; } .tree-panel { border-right: 0; border-bottom: 1px solid #e2e8f0; }
    #project-tree { height: 24rem; } }
</style>
"""

app = serve(
    page,
    packages=[package],
    wire="transports",
    routes=[
        WebSocketRoute("/ws", transports.ws_endpoint(server)),
        Route("/api/tree/{event_type}", tree_event, methods=["POST"]),
    ],
    background=[transports.autosync(server), rotate_server_file()],
    head=styles,
    title="spaday-trees example",
)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8016)
