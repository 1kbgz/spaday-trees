import type { SpadayTree, TreeItemBounds } from "./index.js";

interface Pointer {
  record: string;
  field: "Title" | "Note" | null;
  x: number;
  y: number;
}

// Example-owned overlays use the peer's public geometry API.
export function connectPointers(
  tree: () => SpadayTree | null,
  changed: () => void,
  draw: (cursors: unknown[]) => void,
) {
  let pointer: Pointer | null = null;
  let position: { x: number; y: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let last = "";
  let peers: { peer: string; user: string; pointer?: unknown }[] = [];
  const inputs = () => [
    ...document.querySelectorAll<HTMLInputElement>(
      ".editor:not([hidden]) input",
    ),
  ];
  const geometry = (
    p: Pick<Pointer, "record" | "field">,
  ):
    | (TreeItemBounds & { hit: (x: number, y: number) => boolean })
    | undefined => {
    if (p.field === null) {
      const target = tree();
      const bounds = target?.getItemBounds(p.record);
      return (
        bounds && {
          ...bounds,
          hit: (x, y) => target!.getItemAtPoint(x, y) === p.record,
        }
      );
    }
    const input = inputs().find(
      (el) =>
        el.closest(".editor")?.getAttribute("data-record-id") === p.record &&
        el.getAttribute("aria-label") === p.field,
    );
    if (!input) return undefined;
    const bounds = input.getBoundingClientRect();
    return {
      bounds,
      visibleBounds: bounds,
      hit: (x, y) => document.elementFromPoint(x, y) === input,
    };
  };
  const render = () => {
    frame = 0;
    const cursors = peers.flatMap(({ peer, user, pointer: value }) => {
      if (!value || typeof value !== "object") return [];
      const p = value as Partial<Pointer>;
      if (
        typeof p.record !== "string" ||
        (p.field !== null && p.field !== "Title" && p.field !== "Note") ||
        typeof p.x !== "number" ||
        !Number.isFinite(p.x) ||
        p.x < 0 ||
        p.x > 1 ||
        typeof p.y !== "number" ||
        !Number.isFinite(p.y) ||
        p.y < 0 ||
        p.y > 1
      )
        return [];
      const target = geometry(p as Pointer);
      if (!target) return [];
      const { bounds, visibleBounds: box } = target;
      const x = bounds.left + bounds.width * p.x,
        y = bounds.top + bounds.height * p.y;
      if (!target.hit(x, y)) return [];
      return [
        {
          peer,
          name: user[0].toUpperCase() + user.slice(1),
          className: `remote-pointer person-${user}`,
          style: `left:${x}px;top:${y}px`,
          boxStyle: `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`,
        },
      ];
    });
    const encoded = JSON.stringify(cursors);
    if (encoded !== last) {
      last = encoded;
      draw(cursors);
    }
    for (const element of document.querySelectorAll(
      "main, #people, .workspace",
    )) {
      if (!observed.has(element)) {
        observed.add(element);
        resize.observe(element);
      }
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const resize = new ResizeObserver(schedule);
  const observed = new WeakSet<Element>();
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
    if (pointer) {
      pointer = null;
      changed();
    }
  };
  const layout = () => {
    clear();
    schedule();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    position = { x: event.clientX, y: event.clientY };
    const path = tree()?.getItemAtPoint(event.clientX, event.clientY);
    const input = inputs().find((el) => event.composedPath().includes(el));
    const target =
      path !== undefined
        ? { record: path, field: null }
        : input
          ? {
              record: input.closest(".editor")!.getAttribute("data-record-id")!,
              field: input.getAttribute("aria-label") as Pointer["field"],
            }
          : undefined;
    const bounds = target && geometry(target)?.bounds;
    if (!bounds || !bounds.width || !bounds.height) {
      clear();
      return;
    }
    pointer = {
      ...target!,
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
    if (!timer)
      timer = setTimeout(() => {
        timer = undefined;
        changed();
      }, 40);
  };
  const viewport = (event: Event) => {
    if (event.target !== tree()) return;
    if (pointer && position && !geometry(pointer)?.hit(position.x, position.y))
      clear();
    schedule();
  };
  const visibility = () => {
    if (document.hidden) clear();
  };
  document.addEventListener("viewport-change", viewport);
  document.addEventListener("pointermove", move);
  document.documentElement.addEventListener("pointerleave", clear);
  document.addEventListener("scroll", layout, true);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("resize", layout);
  window.addEventListener("blur", clear);
  window.addEventListener("pagehide", clear);
  return {
    current: () => pointer,
    render(values: typeof peers) {
      peers = values;
      schedule();
    },
    disconnect() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener("viewport-change", viewport);
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", clear);
      document.removeEventListener("scroll", layout, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", layout);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pagehide", clear);
      draw([]);
    },
  };
}
