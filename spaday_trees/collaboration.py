"""Collaborative records with local selection and identity-based edits."""

import asyncio
from contextlib import asynccontextmanager, suppress
from copy import deepcopy

from pydantic import BaseModel, Field
from spaday import CallEndpoint, SetField, Wire, element, eq, event_value, field, item, not_, obj
from spaday.backends.starlette import PageSpec, build_site
from spaday.components import Each
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from transports import WRITE, CrdtDocument, CrdtSpec, Hub, autosync, ws_endpoint

from spaday_trees import Tree, package

RECORDS: list[dict] = [
    {"id": "docs/README.md", "title": "Documentation", "details": {"note": ""}},
    {"id": "src/README.md", "title": "Source", "details": {"note": ""}},
    {"id": "notes/plan.md", "title": "Plan", "details": {"note": ""}},
]


class Board(BaseModel):
    records: list[dict] = Field(default_factory=lambda: deepcopy(RECORDS))
    paths: list[str] = Field(default_factory=lambda: [row["id"] for row in RECORDS])


SPEC = CrdtSpec(
    {
        "kind": "map",
        "fields": {
            "records": {"kind": "set", "keys": [["id"]], "element": {"kind": "map", "fields": {"details": {"kind": "map"}}}},
        },
    }
)

STYLE = """
:root { color-scheme: dark; --spa-surface: #192630; --spa-surface-2: #263945;
  --spa-text: #e4ebef; --spa-muted: #a7bbc7; --spa-border: #344854; --spa-accent: #8bcde5; }
body { margin: 0; background: #101820; color: #e4ebef; font: 16px system-ui; }
main { max-width: 70rem; margin: auto; padding: 2rem; }
.people { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1rem 0; }
.person { display: flex; align-items: center; gap: .6rem; padding: .6rem .8rem; border: 1px solid #344854; border-radius: .5rem; }
.person-alice { --person-color: #f4a261; }
.person-bob { --person-color: #90c2ff; }
.person-viewer { --person-color: #a7d9a4; }
.avatar { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; background: var(--person-color); color: #101820; font-weight: 700; }
.person small { display: block; color: #a7bbc7; margin-top: .2rem; }
nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
a { color: #8bcde5; }
.workspace { display: grid; grid-template-columns: minmax(0, 3fr) minmax(16rem, 2fr); gap: 1.5rem; }
.browser, .editor { padding: 1rem; background: #192630; border: 1px solid #344854; border-radius: .5rem; }
label { display: block; margin: 1rem 0; }
input { box-sizing: border-box; display: block; width: 100%; margin-top: .4rem; padding: .6rem; font: inherit; }
button { padding: .5rem 1rem; font: inherit; cursor: pointer; }
output { display: block; margin: 1rem 0; }
#connected { display: inline; }
[hidden] { display: none !important; }
@media (max-width: 700px) { .workspace { grid-template-columns: 1fr; } main { padding: 1rem; } }
"""


def page(user: str):
    readonly = user == "viewer"
    editor = (
        element(
            "section",
            element("h2").compute("textContent", item("id")),
            element("label", "Title", element("input", readOnly=readonly, **{"aria-label": "Title"}).bind("value", item("title"), mode="two-way")),
            element(
                "label", "Note", element("input", readOnly=readonly, **{"aria-label": "Note"}).bind("value", item("details.note"), mode="two-way")
            ),
            element("button", disabled=readonly)
            .text("Delete")
            .on("click", CallEndpoint("POST", f"/api/{user}/delete", obj({"id": item("id")}), result="deletion")),
            class_="editor",
        )
        .compute("hidden", not_(eq(item("id"), field("selected"))))
        .compute("data-record-id", item("id"))
    )
    person = element(
        "div",
        element("span", class_="avatar", **{"aria-hidden": "true"}).compute("textContent", item("initial")),
        element("div", element("strong").compute("textContent", item("name")), element("small").compute("textContent", item("status"))),
    ).compute("className", item("className"))
    browser = (
        Tree(id="records", style="height: 18rem;")
        .bind("paths", "board.paths")
        .bind("selected_paths", "selected")
        .on("selection-change", SetField("selected", event_value("paths.0")))
    )
    return element(
        "main",
        element("h1").text("Collaborative file metadata"),
        element("nav", *(element("a", name.title(), href=path) for path, name in (("/", "alice"), ("/bob", "bob"), ("/viewer", "viewer")))),
        element("p").text("Select a record to edit its title or note. Selection stays in this tab; edits are shared."),
        element("p").text(f"Signed in as {user}: {'read only' if readonly else 'can edit and delete'}. Demo roles are selected by URL."),
        element("section", Each(person, field="people", key="user"), id="people", class_="people", **{"aria-label": "People in this document"}),
        element("p", "Connected: ", element("output", id="connected").bind("textContent", "board.connected")),
        element("div", element("section", browser, class_="browser"), Each(editor, field="board.records", key="id"), class_="workspace"),
        element("output", id="edit-error").bind("textContent", "$errors.board.records"),
        element("output", id="delete-result").bind("textContent", "deletion.body.message"),
        element("details", element("summary", "Shared state"), element("pre", id="state").bind("textContent", "board.records", codec="json")),
        class_="wa-dark",
    )


def create_app(*, codec: str = "json"):
    # In production, derive both HTTP and WebSocket roles from authenticated users.
    hub = Hub(key=lambda connection: connection.query_params.get("user", "viewer"))
    model = hub.share(Board(), crdt_spec=SPEC)
    for user in ("alice", "bob"):
        hub.subscribe(user, model, WRITE)
    hub.subscribe("viewer", model)

    async def delete(request):
        if request.path_params["user"] not in ("alice", "bob"):
            return JSONResponse({"message": "Read-only view"}, status_code=403)
        body = await request.json()
        if not isinstance(body, dict) or not isinstance(body.get("id"), str):
            return JSONResponse({"message": "Expected a record ID"}, status_code=422)
        snapshot = hub.snapshot_shared(model)
        document = CrdtDocument.from_state(SPEC, snapshot["crdt_state"], "delete-preview")
        value = document.value
        if not any(row["id"] == body["id"] for row in value["records"]):
            return JSONResponse({"message": "Record no longer exists"}, status_code=404)
        value["records"] = [row for row in value["records"] if row["id"] != body["id"]]
        value["paths"] = [row["id"] for row in value["records"]]
        hub.mutate_shared_crdt(model, document.diff(value))
        return JSONResponse({"message": "Deleted record"})

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(autosync(hub))
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    pages = {
        path: PageSpec(
            lambda user=user: page(user),
            packages=[package],
            wire=Wire(f"/ws?user={user}", model=model, namespace="board", codec=codec, reconnect=True),
            store={"selected": RECORDS[0]["id"], "user": user, "people": []},
            title="Collaborative file metadata",
            styles=[STYLE],
            scripts=["/components/trees/cdn/collaboration.js"],
        )
        for path, user in (("/", "alice"), ("/bob", "bob"), ("/viewer", "viewer"))
    }
    return Starlette(
        routes=build_site(pages, routes=[WebSocketRoute("/ws", ws_endpoint(hub)), Route("/api/{user}/delete", delete, methods=["POST"])]).all(),
        lifespan=lifespan,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(create_app(), host="127.0.0.1", port=8043)
