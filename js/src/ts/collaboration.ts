// Example-only adapter: reuse the page's managed transports connection.
interface AwarenessUpdate {
  id: number;
  peer: string;
  state: unknown;
}
interface WireDetail {
  namespace: string | null;
  client: {
    setAwareness(id: number, state: unknown): boolean;
    awareness(id: number): ReadonlyMap<string, unknown>;
    onAwareness(callback: (update: AwarenessUpdate) => void): () => void;
  };
  link: { onModel(callback: (id: number) => void): () => void };
  store: {
    get(field: string): unknown;
    set(field: string, value: unknown): void;
    subscribe(field: string, callback: () => void): () => void;
  };
}
interface Presence {
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
    record: typeof state.record === "string" ? state.record : null,
    field:
      state.field === "Title" || state.field === "Note" ? state.field : null,
  };
}

document.addEventListener("spaday:wire-client", (event) => {
  const { namespace, client, link, store } = (event as CustomEvent<WireDetail>)
    .detail;
  if (namespace !== "board") return;
  let stopModel = () => {};
  let suspend = () => {};
  let resume = () => {};
  let hidden = false;
  const stopLink = link.onModel((id) => {
    stopModel();
    const user = String(store.get("user"));
    if (!users.has(user)) return;
    const peers = new Map(client.awareness(id));
    const records = () => store.get("board.records") as { id: string }[];
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
      return { user, record, field };
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
    const render = () => {
      const others = [...peers.values()].flatMap((value) => {
        const state = presence(value);
        return state ? [person(state)] : [];
      });
      const groups = new Map<string, ReturnType<typeof person>[]>();
      for (const entry of [person(current(), true), ...others]) {
        const group = groups.get(entry.user) ?? [];
        group.push(entry);
        groups.set(entry.user, group);
      }
      store.set(
        "people",
        [...groups.values()].map((group) => ({
          ...group[0],
          name:
            group[0].name + (group.length > 1 ? ` · ${group.length} tabs` : ""),
          status: [...new Set(group.map((entry) => entry.status))].join("; "),
        })),
      );
    };
    let active = true;
    let last = "";
    const publish = () => {
      if (!active || hidden) return;
      const state = current();
      const encoded = JSON.stringify(state);
      if (encoded !== last) {
        last = encoded;
        client.setAwareness(id, state);
      }
      render();
    };
    const focus = () => queueMicrotask(publish);
    const stops = [
      client.onAwareness((update) => {
        if (update.id !== id) return;
        if (update.state === null) peers.delete(update.peer);
        else peers.set(update.peer, update.state);
        render();
      }),
      store.subscribe("selected", publish),
      store.subscribe("board.records", publish),
      store.subscribe("board.connected", render),
    ];
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    suspend = () => client.setAwareness(id, null);
    resume = () => {
      last = "";
      publish();
    };
    publish();
    stopModel = () => {
      active = false;
      stops.forEach((stop) => stop());
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
      client.setAwareness(id, null);
    };
  });
  window.addEventListener("pagehide", (event) => {
    hidden = true;
    suspend();
    if (!event.persisted) {
      stopLink();
      stopModel();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    hidden = false;
    resume();
  });
});
