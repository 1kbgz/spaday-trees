import {
  FileTree,
  type FileTreeDirectoryHandle,
  type FileTreeItemHandle,
  type FileTreeRowDecorationContext,
  type GitStatus,
  type GitStatusEntry,
  type RemappedIcon,
} from "@pierre/trees";

// upstream's isDirectory(): boolean is not a type predicate, so it cannot narrow the handle union
function isDirectoryHandle(
  item: FileTreeItemHandle,
): item is FileTreeDirectoryHandle {
  return item.isDirectory();
}

/**
 * One row's serializable decoration. `badge` (short text) or `icon` (a Pierre
 * icon name or `{name, width?, height?}`) render in the engine's decoration
 * lane after the label; `tone` becomes a `spaday-tone-<tone>` class on the
 * row; `tooltip` becomes the row's `title` (and the lane's).
 */
interface TreeDecoration {
  icon?: RemappedIcon;
  tone?: string;
  badge?: string;
  tooltip?: string;
}

/** Internal per-path decoration after merging the git preset and user entries. */
interface ResolvedDecoration {
  icon?: RemappedIcon;
  tone?: string;
  badge?: string;
  laneTitle?: string;
  rowTitle?: string;
  gitStatus?: GitStatus;
  containsGitChange?: boolean;
}

// Mirrors the engine's built-in git presentation (letters, titles, roll-up dot).
const GIT_STATUS_BADGE: Record<GitStatus, string | null> = {
  added: "A",
  deleted: "D",
  ignored: null,
  modified: "M",
  renamed: "R",
  untracked: "U",
};
const GIT_STATUS_TITLE: Record<GitStatus, string> = {
  added: "Git status: added",
  deleted: "Git status: deleted",
  ignored: "Git status: ignored",
  modified: "Git status: modified",
  renamed: "Git status: renamed",
  untracked: "Git status: untracked",
};
const GIT_ROLLUP_ICON: RemappedIcon = {
  name: "file-tree-icon-dot",
  width: 6,
  height: 6,
};
const GIT_ROLLUP_TITLE = "Contains git status items";

const TONE_CLASS_PREFIX = "spaday-tone-";
const TONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

/*
 * Injected into the engine shadow root through its `unsafeCSS` option (the
 * only supported way to style engine-owned rows). Built-in tones follow the
 * engine's light-dark() token pattern and can be overridden from the page via
 * `--trees-tone-*` custom properties, which inherit into the shadow root.
 */
const DECORATION_CSS = `
  [data-item-git-status] > [data-item-section="decoration"] {
    color: var(--trees-item-git-status-color);
    font-weight: var(--trees-font-weight-semibold);
  }
  [data-item-contains-git-change="true"] > [data-item-section="decoration"] {
    color: var(--trees-git-modified-color);
    opacity: 0.5;
    fill: currentColor;
  }
  [class*="spaday-tone-"] {
    & > :where([data-item-section="icon"]) > :where(:not([data-icon-name="file-tree-icon-chevron"])),
    & > [data-item-section="content"] {
      color: var(--spaday-tone-color, inherit);
    }
  }
  .spaday-tone-info { --spaday-tone-color: var(--trees-tone-info, light-dark(#0969da, #58a6ff)); }
  .spaday-tone-success { --spaday-tone-color: var(--trees-tone-success, light-dark(#1a7f37, #3fb950)); }
  .spaday-tone-warning { --spaday-tone-color: var(--trees-tone-warning, light-dark(#9a6700, #d29922)); }
  .spaday-tone-danger { --spaday-tone-color: var(--trees-tone-danger, light-dark(#cf222e, #f85149)); }
  .spaday-tone-muted { --spaday-tone-color: var(--trees-tone-muted, light-dark(#59636e, #9198a1)); }
`;

/**
 * `<spaday-tree>` wraps Pierre's imperative `FileTree` engine.
 *
 * Setting `selected_paths` reveals the selection: ancestor directories are
 * expanded and the first selected path is scrolled into view. This reveal
 * behaviour is a supported contract.
 *
 * `decorations` maps paths to `{icon?, tone?, badge?, tooltip?}`; `git_status`
 * is a preset over the same pipeline. `expanded_paths` reflects the engine's
 * current expansion and is settable; user toggles dispatch `expansion-change`.
 */
class SpadayTree extends HTMLElement {
  #model: FileTree | null = null;
  #paths: string[] = [];
  #selectedPaths: string[] = [];
  #expandedPathsState: string[] = [];
  #search: string | null = null;
  #gitStatus: GitStatusEntry[] | undefined;
  #decorations: Record<string, TreeDecoration> = {};
  #resolvedDecorations = new Map<string, ResolvedDecoration>();
  #ignoredGitDirectories = new Set<string>();
  #decorationObserver: MutationObserver | null = null;
  #modelSubscription: (() => void) | null = null;
  #applyingSelection = false;
  #applyingSearch = false;
  #applyingExpansion = false;
  #warnedZeroHeight = false;

  connectedCallback(): void {
    if (this.#model) return;
    this.style.display ||= "block";
    this.#model = new FileTree({
      paths: this.#paths,
      initialSelectedPaths: this.#selectedPaths,
      initialSearchQuery: this.#search,
      renderRowDecoration: (context) => this.#renderLaneDecoration(context),
      unsafeCSS: DECORATION_CSS,
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
    this.#applyExpansion();
    this.#applySelection();
    this.#expandedPathsState = this.#currentExpandedPaths();
    this.#modelSubscription = this.#model.subscribe(() =>
      this.#syncExpansion(),
    );
    this.#applyRowDecorations();
    this.#observeEngineRows();
    this.#warnIfZeroHeight();
  }

  disconnectedCallback(): void {
    this.#decorationObserver?.disconnect();
    this.#decorationObserver = null;
    this.#modelSubscription?.();
    this.#modelSubscription = null;
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
    const initialExpandedPaths = this.#currentExpandedPaths();
    this.#paths = [...nextPaths];
    this.#model?.resetPaths(this.#paths, { initialExpandedPaths });
    this.#applySelection();
    this.#applyRowDecorations();
    this.#warnIfZeroHeight();
  }
  get paths(): string[] {
    return this.#paths;
  }

  /**
   * Setting `selected_paths` reveals the selection: ancestor directories are
   * expanded and the first selected path is scrolled into view. A bare string
   * is coerced to a one-element list; other non-list values throw a TypeError.
   */
  set selected_paths(paths: string[] | string) {
    let nextPaths: string[];
    if (typeof paths === "string") {
      nextPaths = [paths];
    } else if (paths && !Array.isArray(paths)) {
      throw new TypeError(
        `selected_paths expects an array of paths (or a single string), received ${typeof paths}`,
      );
    } else {
      nextPaths = paths || [];
    }
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

  /**
   * Expanded directory paths, two-way. Reading reflects the engine's current
   * expansion (canonical `dir/` paths); setting expands the listed directories
   * and collapses every other one. A bare string is coerced to a one-element
   * list; other non-list values throw a TypeError. Independent of the
   * `selected_paths` reveal, which may expand further ancestors.
   */
  set expanded_paths(paths: string[] | string) {
    let nextPaths: string[];
    if (typeof paths === "string") {
      nextPaths = [paths];
    } else if (paths && !Array.isArray(paths)) {
      throw new TypeError(
        `expanded_paths expects an array of directory paths (or a single string), received ${typeof paths}`,
      );
    } else {
      nextPaths = paths || [];
    }
    const canonical = nextPaths.map((path) =>
      path.endsWith("/") ? path : `${path}/`,
    );
    if (
      canonical.length === this.#expandedPathsState.length &&
      canonical.every((path, index) => path === this.#expandedPathsState[index])
    ) {
      return;
    }
    this.#expandedPathsState = canonical;
    this.#applyExpansion();
  }
  get expanded_paths(): string[] {
    return this.#expandedPathsState;
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

  /**
   * Git status entries `[{path, status}]`, rendered as a preset over the
   * decoration pipeline: the engine's status letter, colors, and roll-up dots
   * on ancestor directories. A user decoration for the same path wins
   * field-by-field.
   */
  set git_status(value: GitStatusEntry[] | undefined) {
    this.#gitStatus = value;
    this.#refreshDecorations();
  }
  get git_status(): GitStatusEntry[] | undefined {
    return this.#gitStatus;
  }

  /**
   * Per-path row decorations `{path: {icon?, tone?, badge?, tooltip?}}`. A
   * row shows one lane decoration: `badge` text wins over `icon` (engine
   * limitation — the decoration lane renders a single text-or-icon entry).
   */
  set decorations(value: Record<string, TreeDecoration> | undefined | null) {
    if (value != null && (typeof value !== "object" || Array.isArray(value))) {
      throw new TypeError(
        `decorations expects an object mapping paths to {icon, tone, badge, tooltip}, received ${
          Array.isArray(value) ? "array" : typeof value
        }`,
      );
    }
    this.#decorations = value || {};
    this.#refreshDecorations();
  }
  get decorations(): Record<string, TreeDecoration> {
    return this.#decorations;
  }

  #renderLaneDecoration(context: FileTreeRowDecorationContext) {
    const entry = this.#resolvedFor(context.item.path);
    if (!entry) return null;
    if (entry.badge != null) {
      return { text: entry.badge, title: entry.laneTitle };
    }
    if (entry.icon != null) {
      return { icon: entry.icon, title: entry.laneTitle };
    }
    return null;
  }

  /** Rebuild the resolved map and push it into engine-rendered rows. */
  #refreshDecorations(): void {
    this.#rebuildResolvedDecorations();
    if (!this.#model) return;
    // renderRowDecoration is constructor-only; re-render so visible rows re-run it
    this.#model.render({});
    this.#applyRowDecorations();
  }

  #rebuildResolvedDecorations(): void {
    const resolved = new Map<string, ResolvedDecoration>();
    const ignoredDirectories = new Set<string>();
    for (const entry of this.#gitStatus ?? []) {
      const status = entry?.status;
      const path = entry?.path?.replace(/\/$/, "");
      if (!path || !status) continue;
      const badge = GIT_STATUS_BADGE[status];
      resolved.set(path, {
        gitStatus: status,
        ...(badge == null
          ? {}
          : { badge, laneTitle: GIT_STATUS_TITLE[status] }),
      });
      if (status === "ignored" && entry.path.endsWith("/")) {
        ignoredDirectories.add(path);
      }
    }
    // roll-up dot on ancestor directories, mirroring the engine's native pipeline
    for (const entry of this.#gitStatus ?? []) {
      if (!entry?.path || !entry.status) continue;
      for (const directory of this.#ancestorPaths(entry.path)) {
        const key = directory.replace(/\/$/, "");
        if (!resolved.has(key)) {
          resolved.set(key, {
            icon: GIT_ROLLUP_ICON,
            laneTitle: GIT_ROLLUP_TITLE,
            containsGitChange: true,
          });
        }
      }
    }
    for (const [path, decoration] of Object.entries(this.#decorations)) {
      if (!decoration || typeof decoration !== "object") continue;
      const key = path.replace(/\/$/, "");
      const merged: ResolvedDecoration = { ...resolved.get(key) };
      if (decoration.badge != null) merged.badge = String(decoration.badge);
      if (decoration.icon != null) merged.icon = decoration.icon;
      if (decoration.tone != null) merged.tone = String(decoration.tone);
      if (decoration.tooltip != null) {
        merged.rowTitle = String(decoration.tooltip);
        merged.laneTitle = String(decoration.tooltip);
      }
      if (decoration.badge != null || decoration.icon != null) {
        delete merged.containsGitChange;
      }
      resolved.set(key, merged);
    }
    this.#resolvedDecorations = resolved;
    this.#ignoredGitDirectories = ignoredDirectories;
  }

  #resolvedFor(path: string | null): ResolvedDecoration | null {
    if (!path) return null;
    const key = path.replace(/\/$/, "");
    const direct = this.#resolvedDecorations.get(key);
    if (direct) return direct;
    if (this.#ignoredGitDirectories.size > 0) {
      const segments = key.split("/");
      for (let index = segments.length - 1; index > 0; index -= 1) {
        if (
          this.#ignoredGitDirectories.has(segments.slice(0, index).join("/"))
        ) {
          return { gitStatus: "ignored" };
        }
      }
    }
    return null;
  }

  /**
   * Apply tone classes, row titles, and git status attributes to the rows the
   * engine has rendered. Rows live in the engine's shadow DOM and are recycled
   * by virtualization, so this runs again (via a MutationObserver) whenever
   * the engine re-renders or reuses a row for another path.
   */
  #applyRowDecorations(): void {
    const shadowRoot = this.#model?.getFileTreeContainer()?.shadowRoot;
    if (!shadowRoot) return;
    for (const row of shadowRoot.querySelectorAll<HTMLElement>(
      "[data-item-path]",
    )) {
      const entry = this.#resolvedFor(row.getAttribute("data-item-path"));
      const tone =
        entry?.tone && TONE_NAME_PATTERN.test(entry.tone)
          ? `${TONE_CLASS_PREFIX}${entry.tone}`
          : null;
      for (const name of Array.from(row.classList)) {
        if (name.startsWith(TONE_CLASS_PREFIX) && name !== tone) {
          row.classList.remove(name);
        }
      }
      if (tone) row.classList.add(tone);
      if (entry?.rowTitle) row.setAttribute("title", entry.rowTitle);
      else row.removeAttribute("title");
      if (entry?.gitStatus) {
        row.setAttribute("data-item-git-status", entry.gitStatus);
      } else {
        row.removeAttribute("data-item-git-status");
      }
      if (entry?.containsGitChange) {
        row.setAttribute("data-item-contains-git-change", "true");
      } else {
        row.removeAttribute("data-item-contains-git-change");
      }
    }
  }

  #observeEngineRows(): void {
    const shadowRoot = this.#model?.getFileTreeContainer()?.shadowRoot;
    if (!shadowRoot) return;
    // Virtualized rows are recycled: scrolling re-creates row elements or
    // retargets an existing one's data-item-path, so watch both. Our own
    // writes (class/title/git attributes) don't match this filter.
    this.#decorationObserver = new MutationObserver(() =>
      this.#applyRowDecorations(),
    );
    this.#decorationObserver.observe(shadowRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-item-path"],
    });
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
          if (item && isDirectoryHandle(item)) item.expand();
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

  /**
   * Expand the requested directories (the engine also opens their ancestors),
   * then collapse every directory not requested, so the engine matches the
   * list. Afterwards the property reflects the engine's effective state.
   */
  #applyExpansion(): void {
    if (!this.#model) return;
    const wanted = new Set(this.#expandedPathsState);
    this.#applyingExpansion = true;
    try {
      for (const path of wanted) {
        const item = this.#model.getItem(path);
        if (item && isDirectoryHandle(item)) item.expand();
      }
      for (const directory of this.#directoryPaths()) {
        if (wanted.has(directory)) continue;
        const item = this.#model.getItem(directory);
        if (item && isDirectoryHandle(item) && item.isExpanded()) {
          item.collapse();
        }
      }
    } finally {
      this.#applyingExpansion = false;
    }
    this.#expandedPathsState = this.#currentExpandedPaths();
  }

  #syncExpansion(): void {
    if (!this.#model || this.#applyingExpansion) return;
    const next = this.#currentExpandedPaths();
    if (
      next.length === this.#expandedPathsState.length &&
      next.every((path, index) => path === this.#expandedPathsState[index])
    ) {
      return;
    }
    this.#expandedPathsState = next;
    this.dispatchEvent(
      new CustomEvent("expansion-change", {
        bubbles: true,
        composed: true,
        detail: { paths: [...next] },
      }),
    );
  }

  #warnIfZeroHeight(): void {
    if (this.#warnedZeroHeight || !this.isConnected || !this.#paths.length) {
      return;
    }
    if (this.getBoundingClientRect().height === 0) {
      this.#warnedZeroHeight = true;
      console.warn(
        "<spaday-tree> measured zero height with non-empty paths, so no rows are visible. Give the element or an ancestor a height (or set --trees-min-height).",
      );
    }
  }

  #ancestorPaths(path: string): string[] {
    const parts = path.replace(/\/$/, "").split("/");
    return parts
      .slice(0, -1)
      .map((_part, index) => `${parts.slice(0, index + 1).join("/")}/`);
  }

  #directoryPaths(): string[] {
    const directories = new Set<string>();
    for (const path of this.#paths) {
      for (const directory of this.#ancestorPaths(path)) {
        directories.add(directory);
      }
      if (path.endsWith("/")) directories.add(path);
    }
    return [...directories];
  }

  #currentExpandedPaths(): string[] {
    if (!this.#model) return [];
    const expanded: string[] = [];
    for (const directory of this.#directoryPaths()) {
      const item = this.#model.getItem(directory);
      if (item && isDirectoryHandle(item) && item.isExpanded()) {
        expanded.push(directory);
      }
    }
    return expanded;
  }
}

if (!customElements.get("spaday-tree")) {
  customElements.define("spaday-tree", SpadayTree);
}

export { SpadayTree };
