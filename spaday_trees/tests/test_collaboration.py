import asyncio

import httpx

from spaday_trees.collaboration import create_app


def test_deletion_checks_permissions_and_uses_record_identity():
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://test") as client:
            target = {"id": "docs/README.md"}
            assert (await client.post("/api/viewer/delete", json=target)).status_code == 403
            for body in ([], {}, {"id": 0}):
                assert (await client.post("/api/alice/delete", json=body)).status_code == 422
            assert (await client.post("/api/alice/delete", json=target)).status_code == 200
            assert (await client.post("/api/bob/delete", json=target)).status_code == 404
            assert (await client.post("/api/bob/delete", json={"id": "src/README.md"})).status_code == 200
            assert (await client.get("/")).status_code == 200

    asyncio.run(check())
