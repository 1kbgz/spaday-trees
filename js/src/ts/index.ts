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
  }

  disconnectedCallback(): void {
    this.#model?.unmount();
    this.#model?.cleanUp();
    this.#model = null;
  }

  set paths(paths: string[]) {
    this.#paths = paths || [];
    this.#model?.resetPaths(this.#paths);
    this.#applySelection();
  }
  get paths(): string[] {
    return this.#paths;
  }

  set selected_paths(paths: string[]) {
    this.#selectedPaths = paths || [];
    this.#applySelection();
  }
  get selected_paths(): string[] {
    return this.#selectedPaths;
  }

  set search(value: string | null) {
    this.#search = value;
    if (!this.#model) return;
    this.#applyingSearch = true;
    try {
      this.#model.setSearch(value);
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
    } finally {
      this.#applyingSelection = false;
    }
  }
}

if (!customElements.get("spaday-tree")) {
  customElements.define("spaday-tree", SpadayTree);
}

export { SpadayTree };
