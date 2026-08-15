import { FileTree, type GitStatusEntry } from "@pierre/trees";

class SpadayTree extends HTMLElement {
  #model: FileTree | null = null;
  #paths: string[] = [];
  #selectedPaths: string[] = [];
  #search: string | null = null;
  #gitStatus: GitStatusEntry[] | undefined;
  #applyingSelection = false;
  #applyingSearch = false;

  connectedCallback(): void {
    if (this.#model) return;
    this.style.display ||= "block";
    this.#model = new FileTree({
      paths: this.#paths,
      initialSelectedPaths: this.#selectedPaths,
      initialSearchQuery: this.#search,
      gitStatus: this.#gitStatus,
      search: true,
      onSelectionChange: (paths) => {
        this.#selectedPaths = [...paths];
        if (!this.#applyingSelection) {
          this.dispatchEvent(
            new CustomEvent("selection-change", {
              bubbles: true,
              composed: true,
              detail: { paths: [...paths] },
            }),
          );
        }
      },
      onSearchChange: (value) => {
        this.#search = value;
        if (!this.#applyingSearch) {
          this.dispatchEvent(
            new CustomEvent("search-change", {
              bubbles: true,
              composed: true,
              detail: { value },
            }),
          );
        }
      },
    });
    this.#model.render({ containerWrapper: this });
    this.#applySelection();
  }

  disconnectedCallback(): void {
    this.#model?.unmount();
    this.#model?.cleanUp();
    this.#model = null;
  }

  set paths(paths: string[]) {
    const nextPaths = paths || [];
    if (
      nextPaths.length === this.#paths.length &&
      nextPaths.every((path, index) => path === this.#paths[index])
    ) {
      return;
    }
    const initialExpandedPaths = this.#expandedPaths();
    this.#paths = [...nextPaths];
    this.#model?.resetPaths(this.#paths, { initialExpandedPaths });
    this.#applySelection();
  }
  get paths(): string[] {
    return this.#paths;
  }

  set selected_paths(paths: string[]) {
    const nextPaths = paths || [];
    if (
      nextPaths.length === this.#selectedPaths.length &&
      nextPaths.every((path, index) => path === this.#selectedPaths[index])
    ) {
      return;
    }
    this.#selectedPaths = [...nextPaths];
    this.#applySelection();
  }
  get selected_paths(): string[] {
    return this.#selectedPaths;
  }

  set search(value: string | null) {
    const nextValue = value || null;
    if (nextValue === this.#search) return;
    this.#search = nextValue;
    if (!this.#model) return;
    this.#applyingSearch = true;
    try {
      this.#model.setSearch(nextValue);
    } finally {
      this.#applyingSearch = false;
    }
  }
  get search(): string | null {
    return this.#search;
  }

  set git_status(value: GitStatusEntry[] | undefined) {
    this.#gitStatus = value;
    this.#model?.setGitStatus(value);
  }
  get git_status(): GitStatusEntry[] | undefined {
    return this.#gitStatus;
  }

  #applySelection(): void {
    if (!this.#model) return;
    const selected = new Set(this.#selectedPaths);
    this.#applyingSelection = true;
    try {
      for (const path of this.#model.getSelectedPaths()) {
        if (!selected.has(path)) this.#model.getItem(path)?.deselect();
      }
      for (const path of selected) this.#model.getItem(path)?.select();
      for (const path of selected) {
        for (const directory of this.#ancestorPaths(path)) {
          const item = this.#model.getItem(directory);
          if (item?.isDirectory()) item.expand();
        }
      }
      const firstPath = this.#selectedPaths.find((path) =>
        Boolean(this.#model?.getItem(path)),
      );
      if (firstPath) this.#model.scrollToPath(firstPath, { offset: "nearest" });
    } finally {
      this.#applyingSelection = false;
    }
  }

  #ancestorPaths(path: string): string[] {
    const parts = path.replace(/\/$/, "").split("/");
    return parts
      .slice(0, -1)
      .map((_part, index) => `${parts.slice(0, index + 1).join("/")}/`);
  }

  #expandedPaths(): string[] {
    if (!this.#model) return [];
    const expanded = new Set<string>();
    for (const path of this.#paths) {
      const directories = [
        ...this.#ancestorPaths(path),
        ...(path.endsWith("/") ? [path] : []),
      ];
      for (const directory of directories) {
        const item = this.#model.getItem(directory);
        if (item?.isDirectory() && item.isExpanded()) expanded.add(directory);
      }
    }
    return [...expanded];
  }
}

if (!customElements.get("spaday-tree")) {
  customElements.define("spaday-tree", SpadayTree);
}

export { SpadayTree };
