import { expect, test } from "@playwright/test";

test("registers and reactively updates a Pierre file tree", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["src/index.ts", "README.md"];
    document.body.appendChild(tree);
  });

  const labels = () =>
    page
      .locator("file-tree-container")
      .evaluate((tree) =>
        [...tree.shadowRoot.querySelectorAll('[role="treeitem"]')].map(
          (item) => item.textContent,
        ),
      );
  const labelText = async () => (await labels()).join(" ");
  await expect.poll(labelText).toContain("src");
  await page.locator("spaday-tree").evaluate((tree) => {
    tree.paths = ["docs/guide.md"];
    tree.selected_paths = ["docs/guide.md"];
    tree.search = "guide";
  });
  await expect.poll(labelText).toContain("docs");
  await expect.poll(labelText).not.toContain("README");
});

test("dispatches path-based selection events", async ({ page }) => {
  await page.goto("/dist/index.html");
  const detail = page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["one.txt"];
    document.body.appendChild(tree);
    const event = new Promise((resolve) =>
      tree.addEventListener("selection-change", (value) =>
        resolve(value.detail),
      ),
    );
    tree
      .querySelector("file-tree-container")
      .shadowRoot.querySelector('[role="treeitem"]')
      .click();
    return event;
  });
  await expect(detail).resolves.toEqual({ paths: ["one.txt"] });
});
