import { spawn } from "node:child_process";
import { test, expect } from "@playwright/test";

for (const codec of ["json", "msgpack", "cbor"]) {
  test(`collaborative records retain identity over ${codec}`, async ({
    browser,
  }) => {
    let server;
    const contexts = [];
    try {
      const origin = await new Promise((resolve, reject) => {
        server = spawn(
          process.env.SPADAY_TEST_PYTHON ?? "python",
          [
            "-u",
            "-c",
            `
import socket, uvicorn
from spaday_trees.collaboration import create_app
sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(f"http://127.0.0.1:{sock.getsockname()[1]}", flush=True)
uvicorn.Server(uvicorn.Config(create_app(codec="${codec}"), log_level="error")).run(sockets=[sock])
`,
          ],
          { cwd: "..", stdio: ["ignore", "pipe", "pipe"] },
        );
        server.once("error", reject);
        server.once("exit", (code) =>
          reject(new Error(`Server exited: ${code}`)),
        );
        server.stdout.once("data", (data) => resolve(data.toString().trim()));
        server.stderr.on("data", (data) => process.stderr.write(data));
      });
      await expect
        .poll(async () => {
          try {
            return (await fetch(origin)).status;
          } catch {
            return 0;
          }
        })
        .toBe(200);
      const pages = [];
      const errors = [];
      for (const path of ["/", "/bob", "/viewer"]) {
        const context = await browser.newContext();
        contexts.push(context);
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.addInitScript(() => {
          const Socket = WebSocket;
          window.demoSockets = [];
          window.WebSocket = class extends Socket {
            constructor(...args) {
              super(...args);
              demoSockets.push(this);
            }
          };
        });
        await page.goto(origin + path);
        await expect(
          page.getByRole("textbox", { name: "Title", exact: true }),
        ).toHaveValue("Documentation");
        pages.push(page);
      }
      const [alice, bob, viewer] = pages;
      const title = (page) =>
        page.getByRole("textbox", { name: "Title", exact: true });
      const note = (page) =>
        page.getByRole("textbox", { name: "Note", exact: true });
      const select = async (page, id) => {
        const row = page.locator(`#records [data-item-path="${id}"]`);
        if (!(await row.isVisible())) {
          const parent = id.slice(0, id.lastIndexOf("/") + 1);
          await page.locator(`#records [data-item-path="${parent}"]`).click();
        }
        await row.click();
      };
      const state = (page) =>
        page.locator("#state").evaluate((el) => JSON.parse(el.textContent));
      await alice.locator("#records").evaluate((el) => {
        window.originalPeer = el;
      });
      await title(alice).fill("Shared title");
      await note(bob).fill("Shared note");
      for (const page of pages) {
        await expect(title(page)).toHaveValue("Shared title");
        await expect(note(page)).toHaveValue("Shared note");
      }
      await select(bob, "src/README.md");
      await title(bob).fill("Source edit");
      await expect(title(alice)).toHaveValue("Shared title");
      await expect(title(viewer)).toHaveValue("Shared title");
      await expect(
        viewer.getByRole("button", { name: "Delete", exact: true }),
      ).toBeDisabled();
      // A forged browser write must still be rejected by the Hub.
      await title(viewer).evaluate((el) => {
        el.readOnly = false;
      });
      await title(viewer).fill("Forbidden");
      await expect(viewer.locator("#edit-error")).not.toBeEmpty();
      await expect(title(viewer)).toHaveValue("Shared title");
      expect(
        (
          await viewer.request.post(origin + "/api/viewer/delete", {
            data: { id: "docs/README.md" },
          })
        ).status(),
      ).toBe(403);
      await select(bob, "docs/README.md");
      await contexts[0].setOffline(true);
      // Offline emulation does not close an existing WebSocket.
      await alice.evaluate(() =>
        demoSockets.forEach((socket) => socket.close()),
      );
      await expect(alice.locator("#connected")).toHaveText("false");
      await title(alice).fill("Offline title");
      await note(bob).fill("While disconnected");
      await contexts[0].setOffline(false);
      await expect(alice.locator("#connected")).toHaveText("true");
      for (const page of pages) {
        await expect(title(page)).toHaveValue("Offline title");
        await expect(note(page)).toHaveValue("While disconnected");
      }
      await alice
        .locator('[data-record-id="docs/README.md"] input')
        .first()
        .evaluate((el) => {
          window.deletedInput = el;
        });
      await select(alice, "src/README.md");
      await expect(title(alice)).toHaveValue("Source edit");
      await title(alice).evaluate((el) => {
        window.retainedInput = el;
      });
      await bob.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(bob.locator("#delete-result")).toHaveText("Deleted record");
      for (const page of pages) {
        await expect(
          page.locator('[data-record-id="docs/README.md"]'),
        ).toHaveCount(0);
        await expect
          .poll(async () => (await state(page)).map((row) => row.id).sort())
          .toEqual(["notes/plan.md", "src/README.md"]);
        await expect
          .poll(() =>
            page.locator("#records").evaluate((el) => [...el.paths].sort()),
          )
          .toEqual(["notes/plan.md", "src/README.md"]);
      }
      expect(await title(alice).evaluate((el) => el === retainedInput)).toBe(
        true,
      );
      expect(
        await alice.locator("#records").evaluate((el) => el === originalPeer),
      ).toBe(true);
      await alice.evaluate(() => {
        deletedInput.value = "Late edit";
        deletedInput.dispatchEvent(new Event("input"));
      });
      await note(alice).fill("Surviving record");
      await select(bob, "src/README.md");
      await expect(title(bob)).toHaveValue("Source edit");
      await expect(note(bob)).toHaveValue("Surviving record");
      expect(
        (
          await bob.request.post(origin + "/api/bob/delete", {
            data: { id: "docs/README.md" },
          })
        ).status(),
      ).toBe(404);
      const final = await state(bob);
      await expect.poll(() => state(alice)).toEqual(final);
      await expect.poll(() => state(viewer)).toEqual(final);
      expect(errors).toEqual([]);
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
      if (server && server.exitCode === null)
        await new Promise((resolve) => {
          server.once("exit", resolve);
          server.kill();
        });
    }
  });
}
