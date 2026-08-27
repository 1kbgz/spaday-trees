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

test("renders rows in an auto-height container via the min-height fallback", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const container = document.createElement("div");
    const tree = document.createElement("spaday-tree");
    tree.paths = ["src/index.ts", "src/app.ts", "README.md"];
    container.appendChild(tree);
    document.body.appendChild(container);
  });

  const engine = page.locator("spaday-tree file-tree-container");
  await expect(engine).toHaveAttribute("data-file-tree-virtualized", "true");
  await expect
    .poll(() => engine.evaluate((host) => host.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(200);
  await expect
    .poll(() =>
      engine.evaluate(
        (host) => host.shadowRoot.querySelectorAll('[role="treeitem"]').length,
      ),
    )
    .toBeGreaterThan(0);
});

test("warns once when the tree measures zero height with paths", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("zero height"))
      warnings.push(message.text());
  });
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.style.height = "0px";
    tree.style.overflow = "hidden";
    tree.paths = ["one.txt"];
    document.body.appendChild(tree);
    tree.paths = ["one.txt", "two.txt"];
  });
  await expect.poll(() => warnings.length).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain("Give the element or an ancestor a height");
});

test("coerces a string selected_paths and rejects non-list values", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  const result = await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["docs/guide.md", "README.md"];
    document.body.appendChild(tree);
    tree.selected_paths = "docs/guide.md";
    let error = null;
    try {
      tree.selected_paths = 3;
    } catch (err) {
      error = String(err);
    }
    return { selected: tree.selected_paths, error };
  });
  expect(result.selected).toEqual(["docs/guide.md"]);
  expect(result.error).toContain("TypeError");
  expect(result.error).toContain("selected_paths");
  expect(result.error).toContain("number");

  const folder = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/"]',
  );
  const item = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/guide.md"]',
  );
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(item).toHaveAttribute("aria-selected", "true");
});

test("exposes stable row hooks inside the engine shadow root", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["src/index.ts"];
    document.body.appendChild(tree);
  });

  const row = page.locator('spaday-tree [data-item-path="src/"]');
  await expect(row).toHaveAttribute("role", "treeitem");
  const counts = await page
    .locator("spaday-tree file-tree-container")
    .evaluate((host) => ({
      light: host.querySelectorAll('[data-item-path], [role="treeitem"]')
        .length,
      shadow: host.shadowRoot.querySelectorAll(
        '[data-item-path], [role="treeitem"]',
      ).length,
    }));
  expect(counts.light).toBe(0);
  expect(counts.shadow).toBeGreaterThan(0);
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

test("applies tone classes, badges, and tooltips from decorations", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["README.md", "src/index.ts"];
    tree.decorations = {
      "README.md": { tone: "danger", badge: "3", tooltip: "3 problems" },
    };
    document.body.appendChild(tree);
  });

  const row = page.locator(
    'spaday-tree file-tree-container [data-item-path="README.md"]',
  );
  await expect(row).toHaveClass(/spaday-tone-danger/);
  await expect(row).toHaveAttribute("title", "3 problems");
  await expect(row.locator('[data-item-section="decoration"]')).toHaveText("3");
  await expect
    .poll(() =>
      row
        .locator('[data-item-section="content"]')
        .evaluate((element) => getComputedStyle(element).color),
    )
    .toBe("rgb(207, 34, 46)");

  await page.locator("spaday-tree").evaluate((tree) => {
    tree.decorations = {};
  });
  await expect(row).not.toHaveClass(/spaday-tone-danger/);
  await expect(row).not.toHaveAttribute("title");
});

test("keeps decorations applied across virtualized scroll", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.style.height = "200px";
    tree.paths = Array.from(
      { length: 300 },
      (_, index) => `file-${String(index).padStart(3, "0")}.txt`,
    );
    tree.decorations = { "file-299.txt": { tone: "success", badge: "S" } };
    document.body.appendChild(tree);
  });

  const engine = page.locator("spaday-tree file-tree-container");
  await expect
    .poll(() =>
      engine.evaluate(
        (host) => host.shadowRoot.querySelectorAll("[data-item-path]").length,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await engine.evaluate((host) =>
      Boolean(host.shadowRoot.querySelector('[data-item-path="file-299.txt"]')),
    ),
  ).toBe(false);

  await engine.evaluate((host) => {
    const scroller = host.shadowRoot.querySelector(
      "[data-file-tree-virtualized-scroll]",
    );
    scroller.scrollTop = scroller.scrollHeight;
  });
  const row = page.locator(
    'spaday-tree file-tree-container [data-item-path="file-299.txt"]',
  );
  await expect(row).toHaveClass(/spaday-tone-success/);
  await expect(row.locator('[data-item-section="decoration"]')).toHaveText("S");
});

test("renders git_status letters, colors, and directory roll-up dots", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["README.md", "docs/guide.md"];
    tree.git_status = [
      { path: "README.md", status: "modified" },
      { path: "docs/guide.md", status: "added" },
    ];
    document.body.appendChild(tree);
  });

  const readme = page.locator(
    'spaday-tree file-tree-container [data-item-path="README.md"]',
  );
  await expect(readme).toHaveAttribute("data-item-git-status", "modified");
  const lane = readme.locator('[data-item-section="decoration"]');
  await expect(lane).toHaveText("M");
  await expect(lane.locator("span")).toHaveAttribute(
    "title",
    "Git status: modified",
  );
  await expect
    .poll(() =>
      readme
        .locator('[data-item-section="content"]')
        .evaluate((element) => getComputedStyle(element).color),
    )
    .toBe("rgb(28, 161, 199)");

  const docs = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/"]',
  );
  await expect(docs).toHaveAttribute("data-item-contains-git-change", "true");
  await expect(
    docs.locator('[data-item-section="decoration"] svg'),
  ).toHaveCount(1);

  await page.locator("spaday-tree").evaluate((tree) => {
    tree.git_status = [];
  });
  await expect(readme).not.toHaveAttribute("data-item-git-status");
  await expect(docs).not.toHaveAttribute("data-item-contains-git-change");
});

test("expands and collapses folders to match expanded_paths", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    // src/ keeps two children so the engine does not flatten it into src/deep
    tree.paths = [
      "docs/guide.md",
      "src/deep/one.ts",
      "src/main.ts",
      "README.md",
    ];
    document.body.appendChild(tree);
    tree.expanded_paths = ["docs/"];
  });

  const docs = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/"]',
  );
  const src = page.locator(
    'spaday-tree file-tree-container [data-item-path="src/"]',
  );
  await expect(docs).toHaveAttribute("aria-expanded", "true");
  await expect(src).toHaveAttribute("aria-expanded", "false");

  await page.locator("spaday-tree").evaluate((tree) => {
    tree.expanded_paths = ["src/", "src/deep/"];
  });
  await expect(src).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator(
      'spaday-tree file-tree-container [data-item-path="src/deep/"]',
    ),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(docs).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.locator("spaday-tree").evaluate((tree) => tree.expanded_paths),
  ).toEqual(["src/", "src/deep/"]);

  await page.locator("spaday-tree").evaluate((tree) => {
    tree.expanded_paths = [];
  });
  await expect(src).toHaveAttribute("aria-expanded", "false");
  await expect(docs).toHaveAttribute("aria-expanded", "false");
});

test("user folder toggles update expanded_paths and dispatch expansion-change", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["docs/guide.md", "README.md"];
    window.expansionEvents = [];
    tree.addEventListener("expansion-change", (event) =>
      window.expansionEvents.push(event.detail.paths),
    );
    document.body.appendChild(tree);
  });

  const docs = page.locator(
    'spaday-tree file-tree-container [data-item-path="docs/"]',
  );
  await docs.click();
  await expect(docs).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.locator("spaday-tree").evaluate((tree) => tree.expanded_paths),
  ).toEqual(["docs/"]);
  expect(await page.evaluate(() => window.expansionEvents)).toEqual([
    ["docs/"],
  ]);

  await docs.click();
  await expect(docs).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.locator("spaday-tree").evaluate((tree) => tree.expanded_paths),
  ).toEqual([]);
  expect(await page.evaluate(() => window.expansionEvents)).toEqual([
    ["docs/"],
    [],
  ]);
});

test("coerces a string expanded_paths and rejects non-list values", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  const result = await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["docs/guide.md", "README.md"];
    document.body.appendChild(tree);
    tree.expanded_paths = "docs";
    let error = null;
    try {
      tree.expanded_paths = 3;
    } catch (err) {
      error = String(err);
    }
    return { expanded: tree.expanded_paths, error };
  });
  expect(result.expanded).toEqual(["docs/"]);
  expect(result.error).toContain("TypeError");
  expect(result.error).toContain("expanded_paths");
  expect(result.error).toContain("number");
  await expect(
    page.locator('spaday-tree file-tree-container [data-item-path="docs/"]'),
  ).toHaveAttribute("aria-expanded", "true");
});

test("keeps expanded_paths in sync with the selected_paths reveal", async ({
  page,
}) => {
  await page.goto("/dist/index.html");
  await page.evaluate(() => {
    const tree = document.createElement("spaday-tree");
    tree.paths = ["spaday_trees/components.py", "README.md"];
    document.body.appendChild(tree);
    tree.selected_paths = ["spaday_trees/components.py"];
  });

  await expect(
    page.locator(
      'spaday-tree file-tree-container [data-item-path="spaday_trees/"]',
    ),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.locator("spaday-tree").evaluate((tree) => tree.expanded_paths),
  ).toEqual(["spaday_trees/"]);
});

test("runs the Python explorer with server and selection updates", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:8016");
  const tree = page.locator("spaday-tree");
  await expect(tree).toBeVisible();

  await page.getByRole("button", { name: "Select component" }).click();
  await expect(page.locator(".event-status")).toContainText(
    "Selected spaday_trees/components.py",
  );
  await expect(
    tree.locator('[data-item-path="spaday_trees/"]'),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(tree.locator('[data-item-path="server/"]')).toBeVisible({
    timeout: 7_000,
  });
});
