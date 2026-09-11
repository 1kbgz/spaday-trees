import fs from "fs";
import { expect, test } from "@playwright/test";

const built = fs.existsSync("dist/lite/index.html");

test("runs the complete example in Pyodide", async ({ page }) => {
  test.skip(!built, "run `make pyodide-example` first");
  test.setTimeout(180_000);

  await page.goto("/dist/lite/index.html");
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.ready === "true" ||
      document.querySelector("#pyodide-status")?.textContent ===
        "Unable to start",
    undefined,
    { timeout: 150_000 },
  );
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(
    page.getByText("Pierre Trees workspace", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("spaday-tree")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("file-tree-container")
        .evaluate(
          (tree) =>
            tree.shadowRoot.querySelectorAll('[role="treeitem"]').length,
        ),
    )
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Select component" }).click();
  await expect(page.locator(".event-status")).toHaveText(
    "Selected spaday_trees/components.py",
  );
  await expect(page.locator(".connection")).toHaveText(
    /Server added server\/review-\d+\.md/,
    { timeout: 10_000 },
  );
});
