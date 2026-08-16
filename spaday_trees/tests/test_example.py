import asyncio

import httpx
import pytest

from spaday_trees import example


async def request(method: str, path: str, **kwargs):
    transport = httpx.ASGITransport(app=example.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://example") as client:
        return await client.request(method, path, **kwargs)


def test_example_serves_tree_and_synchronizes_both_directions(monkeypatch):
    response = asyncio.run(request("GET", "/tree.json"))
    assert response.status_code == 200
    assert "spaday-tree" in response.text

    sleeps = 0

    class StreamComplete(Exception):
        pass

    async def one_tick(_delay):
        nonlocal sleeps
        sleeps += 1
        if sleeps > 1:
            raise StreamComplete

    monkeypatch.setattr(example.asyncio, "sleep", one_tick)
    with pytest.raises(StreamComplete):
        asyncio.run(example.rotate_server_file())
    assert "server/review-01.md" in example.feed.paths

    response = asyncio.run(request("POST", "/api/tree/selection", json={"paths": ["README.md"]}))
    assert response.json() == {"message": "Selected README.md"}
    assert example.feed.selected_paths == ["README.md"]

    response = asyncio.run(request("POST", "/api/tree/search", json={"value": "components"}))
    assert response.json() == {"message": "Searching for “components”"}
    assert example.feed.search == "components"
