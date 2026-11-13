import type { SpadayTree } from "./index.js";
import { connectPointers } from "./collaboration-pointers.js";

// Example-only adapter: reuse the page's managed transports connection.
interface WireDetail {
  namespace: string | null;
  store: {
    get(field: string): unknown;
    set(field: string, value: unknown): void;
    subscribe(field: string, callback: () => void): () => void;
  };
}
interface Presence {
  pointer?: unknown;
  user: string;
  record: string | null;
  field: string | null;
}
const users = new Set(["alice", "bob", "viewer"]);

function presence(value: unknown): Presence | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<Presence>;
  if (typeof state.user !== "string" || !users.has(state.user)) return null;
  return {
    user: state.user,
    pointer: state.pointer,
    record: typeof state.record === "string" ? state.record : null,
    field:
      state.field === "Title" || state.field === "Note" ? state.field : null,
  };
}

document.addEventListener("spaday:wire-client", (event) => {
  const { namespace, store } = (event as CustomEvent<WireDetail>).detail;
  if (namespace !== "board") return;
  const user = String(store.get("user"));
  if (!users.has(user)) return;
  const peers = () =>
    new Map(
      (
        (store.get("remote_activity") as { peer: string; state: unknown }[]) ??
        []
      ).map(({ peer, state }) => [peer, state]),
    );
  const records = () =>
    (store.get("board.records") as { id: string }[] | undefined) ?? [];
  const current = (): Presence => {
    const selected = store.get("selected");
    const record = records().some((row) => row.id === selected)
      ? String(selected)
      : null;
    const input = document.activeElement;
    const field =
      record &&
      input instanceof HTMLInputElement &&
      !input.readOnly &&
      input.closest(".editor")?.getAttribute("data-record-id") === record
        ? input.getAttribute("aria-label")
        : null;
    return { user, record, field, pointer: pointers.current() };
  };
  const person = (state: Presence, local = false) => {
    const record = records().some((row) => row.id === state.record)
      ? state.record
      : null;
    return {
      user: state.user,
      name:
        state.user[0].toUpperCase() +
        state.user.slice(1) +
        (local ? " (you)" : ""),
      initial: state.user[0].toUpperCase(),
      className: `person person-${state.user}`,
      status:
        local && !store.get("board.connected")
          ? "Offline"
          : record
            ? `${state.field && state.user !== "viewer" ? `Editing ${state.field.toLowerCase()}` : "Viewing"} · ${record}`
            : "Choosing a record",
    };
  };
  let lastPeople = "";
  const render = () => {
    pointers.render(
      [...peers()].flatMap(([peer, value]) => {
        const state = presence(value);
        return state &&
          records().some(
            (row) =>
              row.id === (state.pointer as { record?: unknown } | null)?.record,
          )
          ? [{ peer, user: state.user, pointer: state.pointer }]
          : [];
      }),
    );
    const others = [...peers().values()].flatMap((value) => {
      const state = presence(value);
      return state ? [person(state)] : [];
    });
    const groups = new Map<string, ReturnType<typeof person>[]>();
    for (const entry of [person(current(), true), ...others]) {
      const group = groups.get(entry.user) ?? [];
      group.push(entry);
      groups.set(entry.user, group);
    }
    const people = [...groups.values()].map((group) => ({
      ...group[0],
      name: group[0].name + (group.length > 1 ? ` · ${group.length} tabs` : ""),
      status: [...new Set(group.map((entry) => entry.status))].join("; "),
    }));
    const encodedPeople = JSON.stringify(people);
    if (encodedPeople !== lastPeople) {
      lastPeople = encodedPeople;
      store.set("people", people);
    }
  };
  let active = true;
  let last = "";
  const publish = () => {
    if (!active) return;
    const state = current();
    const encoded = JSON.stringify(state);
    if (encoded !== last) {
      last = encoded;
      store.set("activity", state);
    }
    render();
  };
  const pointers = connectPointers(
    () => document.querySelector<SpadayTree>("#records"),
    publish,
    (cursors) => store.set("cursors", cursors),
  );
  const focus = () => queueMicrotask(publish);
  const stops = [
    store.subscribe("remote_activity", render),
    store.subscribe("selected", publish),
    store.subscribe("board.records", publish),
    store.subscribe("board.connected", render),
  ];
  document.addEventListener("focusin", focus);
  document.addEventListener("focusout", focus);
  publish();
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    active = false;
    pointers.disconnect();
    stops.forEach((stop) => stop());
    document.removeEventListener("focusin", focus);
    document.removeEventListener("focusout", focus);
  });
});
