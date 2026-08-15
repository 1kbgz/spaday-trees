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

test("reveals a programmatically selected nested path", async ({ page }) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = [
      "spaday_trees/__init__.py",
      "spaday_trees/components.py",
      "README.md",
    ];
    document.body.appendChild(tree);
    tree.selected_paths = ["spaday_trees/components.py"];
  });

  const folder = page.locator(
    'spaday-tree file-tree-container [data-item-path="spaday_trees/"]',
  );
  const component = page.locator(
    'spaday-tree file-tree-container [data-item-path="spaday_trees/components.py"]',
  );
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(component).toHaveAttribute("aria-selected", "true");
});

test("preserves expanded folders across reactive path updates", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["docs/guide.md", "docs/reference.md"];
    tree.search = "";
    tree.addEventListener("selection-change", (event) => {
      tree.paths = [...tree.paths];
      tree.selected_paths = [...event.detail.paths];
      tree.search = tree.search;
    });
    document.body.appendChild(tree);
  });

  const folder = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/"]',
  );
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "true");

  await page.locator("spaday-tree").evaluate((tree) => {
    tree.paths = [...tree.paths, "server/review.md"];
  });
  await expect(folder).toHaveAttribute("aria-expanded", "true");
});
