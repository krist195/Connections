import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type {
  ConnectionsFile,
  Person,
  Connection,
  ConnectionKind,
  FamilyRole,
  Lang,
  PendingConnection,
  SocialLink,
  Viewport,
  Ternary
} from "./types";

function nowISO() {
  return new Date().toISOString();
}

function defaultFile(language: Lang = "ru"): ConnectionsFile {
  const t = nowISO();
  return {
    meta: {
      app: "Connections",
      version: 1,
      createdAt: t,
      updatedAt: t,
      language
    },
    people: {},
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 }
  };
}

function newPerson(x: number, y: number): Person {
  return {
    id: uuid(),
    position: { x, y },

    photos: [],

    name: null,
    surname: null,
    nickname: null,
    birthday: null,
    city: null,

    smokes: "unknown",
    uses: "unknown",
    subculture: "unknown",
    orientation: "unknown",
    finance: "unknown",
    relationshipStatus: "unknown",

    heightCm: null,
    weightKg: null,
    bodyType: "unknown",
    eyeColor: "unknown",
    hairLength: "unknown",
    hairStyle: "unknown",
    hairColor: "unknown",
    tattoos: "unknown",
    piercing: "unknown",

    phone: null,
    email: null,
    occupation: null,
    tags: [],
    socials: [],

    notes: ""
  };
}

function touch(file: ConnectionsFile) {
  file.meta.updatedAt = nowISO();
}

function connectionColor(kind: ConnectionKind, role?: FamilyRole) {
  if (kind === "acquaintance") return "#a855f7";
  if (kind === "friend") return "#38bdf8";
  if (kind === "best_friend") return "#22c55e";
  if (role === "mother") return "#ef4444";
  if (role === "father") return "#f59e0b";
  if (role === "brother") return "#fb923c";
  if (role === "sister") return "#f472b6";
  return "#f59e0b";
}

function existsBetween(connections: Connection[], a: string, b: string) {
  return connections.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
}

function asTernary(v: any): Ternary {
  return v === "yes" || v === "no" || v === "unknown" ? v : "unknown";
}

function normalizeLoadedFile(raw: any): ConnectionsFile {
  const base = defaultFile((raw?.meta?.language === "en" ? "en" : "ru") as Lang);

  const file: ConnectionsFile = {
    meta: {
      ...base.meta,
      ...(raw?.meta ?? {})
    },
    people: {},
    connections: Array.isArray(raw?.connections) ? raw.connections : [],
    viewport: raw?.viewport ?? base.viewport
  };

  file.meta.app = "Connections";
  file.meta.version = typeof file.meta.version === "number" ? file.meta.version : 1;
  file.meta.createdAt = file.meta.createdAt ?? base.meta.createdAt;
  file.meta.updatedAt = file.meta.updatedAt ?? base.meta.updatedAt;

  file.viewport = {
    x: typeof file.viewport?.x === "number" ? file.viewport.x : 0,
    y: typeof file.viewport?.y === "number" ? file.viewport.y : 0,
    scale: typeof file.viewport?.scale === "number" ? file.viewport.scale : 1
  };

  const peopleRaw = raw?.people && typeof raw.people === "object" ? raw.people : {};
  for (const [id, pAny] of Object.entries<any>(peopleRaw)) {
    const p = pAny ?? {};
    const safe: Person = {
      ...newPerson(0, 0),
      id,

      position: {
        x: typeof p.position?.x === "number" ? p.position.x : 0,
        y: typeof p.position?.y === "number" ? p.position.y : 0
      },

      photos: Array.isArray(p.photos) ? p.photos : [],

      name: typeof p.name === "string" ? p.name : null,
      surname: typeof p.surname === "string" ? p.surname : null,
      nickname: typeof p.nickname === "string" ? p.nickname : null,
      birthday: typeof p.birthday === "string" ? p.birthday : null,
      city: typeof p.city === "string" ? p.city : null,

      smokes: asTernary(p.smokes),
      uses: asTernary(p.uses),

      subculture: typeof p.subculture === "string" ? p.subculture : "unknown",
      orientation: typeof p.orientation === "string" ? p.orientation : "unknown",
      finance: typeof p.finance === "string" ? p.finance : "unknown",
      relationshipStatus: typeof p.relationshipStatus === "string" ? p.relationshipStatus : "unknown",

      heightCm: typeof p.heightCm === "number" ? p.heightCm : null,
      weightKg: typeof p.weightKg === "number" ? p.weightKg : null,
      bodyType: typeof p.bodyType === "string" ? p.bodyType : "unknown",
      eyeColor: typeof p.eyeColor === "string" ? p.eyeColor : "unknown",
      hairLength: typeof p.hairLength === "string" ? p.hairLength : "unknown",
      hairStyle: typeof p.hairStyle === "string" ? p.hairStyle : "unknown",
      hairColor: typeof p.hairColor === "string" ? p.hairColor : "unknown",
      tattoos: asTernary(p.tattoos),
      piercing: asTernary(p.piercing),

      phone: typeof p.phone === "string" ? p.phone : null,
      email: typeof p.email === "string" ? p.email : null,
      occupation: typeof p.occupation === "string" ? p.occupation : null,
      tags: Array.isArray(p.tags) ? p.tags.filter((x: any) => typeof x === "string") : [],
      socials: Array.isArray(p.socials) ? p.socials : [],

      notes: typeof p.notes === "string" ? p.notes : ""
    };

    safe.socials = safe.socials
      .filter((s: any) => s && typeof s === "object")
      .map((s: any) => ({
        id: typeof s.id === "string" ? s.id : uuid(),
        type: typeof s.type === "string" ? s.type : "",
        value: typeof s.value === "string" ? s.value : ""
      }));

    file.people[id] = safe;
  }

  file.connections = file.connections
    .filter((c: any) => c && typeof c === "object")
    .map((c: any) => ({
      id: typeof c.id === "string" ? c.id : uuid(),
      from: String(c.from),
      to: String(c.to),
      kind: (c.kind as any) ?? "acquaintance",
      familyRole: c.familyRole,
      color: typeof c.color === "string" ? c.color : connectionColor(c.kind, c.familyRole)
    }))
    .filter((c) => file.people[c.from] && file.people[c.to]);

  return file;
}

export type TabState = {
  id: string;
  file: ConnectionsFile;
  filePath: string | null;
  dirty: boolean;

  selectedId: string | null;
  pendingConnection: PendingConnection;
  multiSelectedIds: string[];
};

export type SessionState = {
  version: 1;
  activeTabId: string;
  tabs: TabState[];
};

type StoreState = {
  file: ConnectionsFile;
  filePath: string | null;
  dirty: boolean;

  selectedId: string | null;
  pendingConnection: PendingConnection;
  multiSelectedIds: string[];

  tabs: TabState[];
  activeTabId: string;

  newFile: () => void;
  openFileFromDisk: (raw: any, path: string) => void;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;

  setSession: (s: SessionState) => void;

  setFilePath: (path: string | null) => void;
  markSaved: (path?: string | null) => void;

  setLanguage: (lang: Lang) => void;
  setViewport: (vp: Viewport) => void;

  setSelected: (id: string | null) => void;

  setMultiSelected: (ids: string[]) => void;
  toggleMultiSelected: (id: string) => void;
  clearMultiSelected: () => void;

  addPersonAt: (x: number, y: number) => void;
  movePerson: (id: string, x: number, y: number) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  deleteManyPeople: (ids: string[]) => void;

  addPhotos: (id: string, photosBase64: string[]) => void;
  removePhoto: (id: string, index: number) => void;

  addSocial: (id: string, type: string, value: string) => void;
  updateSocial: (personId: string, socialId: string, patch: Partial<SocialLink>) => void;
  removeSocial: (personId: string, socialId: string) => void;

  setPendingConnection: (from: string, to: string) => void;
  clearPendingConnection: () => void;
  connectionExistsBetween: (a: string, b: string) => boolean;
  addConnection: (from: string, to: string, kind: ConnectionKind, role?: FamilyRole) => void;
};

function makeUntitledTab(language: Lang): TabState {
  return {
    id: uuid(),
    file: defaultFile(language),
    filePath: null,
    dirty: false,
    selectedId: null,
    pendingConnection: null,
    multiSelectedIds: []
  };
}

function snapshotActive(s: StoreState): TabState {
  return {
    id: s.activeTabId,
    file: s.file,
    filePath: s.filePath,
    dirty: s.dirty,
    selectedId: s.selectedId,
    pendingConnection: s.pendingConnection,
    multiSelectedIds: s.multiSelectedIds
  };
}

function commitActiveToTabs(s: StoreState) {
  const snap = snapshotActive(s);
  return s.tabs.map((t) => (t.id === s.activeTabId ? snap : t));
}

function applyTabToState(s: StoreState, tab: TabState): StoreState {
  return {
    ...s,
    activeTabId: tab.id,
    file: tab.file,
    filePath: tab.filePath,
    dirty: tab.dirty,
    selectedId: tab.selectedId,
    pendingConnection: tab.pendingConnection,
    multiSelectedIds: tab.multiSelectedIds
  };
}

function updateActiveTab(s: StoreState, patch: Partial<TabState>): StoreState {
  const updatedTab: TabState = {
    id: s.activeTabId,
    file: patch.file ?? s.file,
    filePath: typeof patch.filePath !== "undefined" ? patch.filePath! : s.filePath,
    dirty: typeof patch.dirty === "boolean" ? patch.dirty : s.dirty,
    selectedId: typeof patch.selectedId !== "undefined" ? patch.selectedId! : s.selectedId,
    pendingConnection: typeof patch.pendingConnection !== "undefined" ? patch.pendingConnection! : s.pendingConnection,
    multiSelectedIds: patch.multiSelectedIds ?? s.multiSelectedIds
  };

  const tabs = commitActiveToTabs(s).map((t) => (t.id === s.activeTabId ? updatedTab : t));
  const next = applyTabToState({ ...s, tabs }, updatedTab);
  return next;
}

export const useStore = create<StoreState>((set, get) => {
  const first = makeUntitledTab("ru");

  return {
    file: first.file,
    filePath: first.filePath,
    dirty: first.dirty,

    selectedId: first.selectedId,
    pendingConnection: first.pendingConnection,
    multiSelectedIds: first.multiSelectedIds,

    tabs: [first],
    activeTabId: first.id,

    // ---------- tabs ----------
    newFile: () =>
      set((s) => {
        const tabsCommitted = commitActiveToTabs(s);
        const tab = makeUntitledTab(s.file.meta.language);
        const tabs = [...tabsCommitted, tab];
        const next = applyTabToState({ ...s, tabs }, tab);
        return next;
      }),

    openFileFromDisk: (raw, path) =>
      set((s) => {
        const tabsCommitted = commitActiveToTabs(s);

        const exists = tabsCommitted.find((t) => t.filePath === path);
        if (exists) {
          const next = applyTabToState({ ...s, tabs: tabsCommitted }, exists);
          return next;
        }

        const tab: TabState = {
          id: uuid(),
          file: normalizeLoadedFile(raw),
          filePath: path,
          dirty: false,
          selectedId: null,
          pendingConnection: null,
          multiSelectedIds: []
        };

        const tabs = [...tabsCommitted, tab];
        const next = applyTabToState({ ...s, tabs }, tab);
        return next;
      }),

    switchTab: (tabId) =>
      set((s) => {
        if (s.activeTabId === tabId) return s;

        const tabsCommitted = commitActiveToTabs(s);
        const nextTab = tabsCommitted.find((t) => t.id === tabId);
        if (!nextTab) return { ...s, tabs: tabsCommitted };

        const next = applyTabToState({ ...s, tabs: tabsCommitted }, nextTab);
        return next;
      }),

    closeTab: (tabId) =>
      set((s) => {
        const tabsCommitted = commitActiveToTabs(s);

        if (tabsCommitted.length <= 1) {
          const tab = makeUntitledTab(s.file.meta.language);
          const next = applyTabToState({ ...s, tabs: [tab] }, tab);
          return next;
        }

        const idx = tabsCommitted.findIndex((t) => t.id === tabId);
        if (idx === -1) return { ...s, tabs: tabsCommitted };

        const newTabs = tabsCommitted.filter((t) => t.id !== tabId);

        if (s.activeTabId !== tabId) {
          // активная не закрыта — просто убрать
          return { ...s, tabs: newTabs };
        }

        const nextTab = newTabs[Math.max(0, idx - 1)] ?? newTabs[0];
        const next = applyTabToState({ ...s, tabs: newTabs }, nextTab);
        return next;
      }),

    // ---------- session ----------
    setSession: (sess) =>
      set((s) => {
        if (!sess || sess.version !== 1 || !Array.isArray(sess.tabs) || sess.tabs.length === 0) return s;

        const tabs: TabState[] = sess.tabs
          .filter((t) => t && typeof t === "object" && typeof t.id === "string")
          .map((t) => {
            const safeFile = normalizeLoadedFile((t as any).file);
            const tb: TabState = {
              id: (t as any).id,
              file: safeFile,
              filePath: typeof (t as any).filePath === "string" ? (t as any).filePath : null,
              dirty: !!(t as any).dirty,
              selectedId: typeof (t as any).selectedId === "string" ? (t as any).selectedId : null,
              pendingConnection: (t as any).pendingConnection ?? null,
              multiSelectedIds: Array.isArray((t as any).multiSelectedIds)
                ? (t as any).multiSelectedIds.filter((x: any) => typeof x === "string")
                : []
            };

            if (tb.selectedId && !tb.file.people[tb.selectedId]) tb.selectedId = null;
            tb.multiSelectedIds = tb.multiSelectedIds.filter((id) => !!tb.file.people[id]);

            if (tb.pendingConnection) {
              const { from, to } = tb.pendingConnection;
              if (!tb.file.people[from] || !tb.file.people[to]) tb.pendingConnection = null;
            }
            return tb;
          });

        const active = tabs.find((t) => t.id === sess.activeTabId) ?? tabs[0];
        const next: StoreState = applyTabToState({ ...s, tabs }, active);
        return next;
      }),

    // ---------- file meta ----------
    setFilePath: (path) =>
      set((s) => {
        const next = updateActiveTab(s, { filePath: path });
        return next;
      }),

    markSaved: (path) =>
      set((s) => {
        const newPath = typeof path !== "undefined" ? path ?? null : s.filePath;
        const next = updateActiveTab(s, { filePath: newPath, dirty: false });
        return next;
      }),

    // ---------- app ----------
    setLanguage: (lang) =>
      set((s) => {
        if (s.file.meta.language === lang) return s;
        const file = structuredClone(s.file);
        file.meta.language = lang;
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    setViewport: (vp) =>
      set((s) => {
        const cur = s.file.viewport;
        if (
          Math.abs(cur.x - vp.x) < 0.001 &&
          Math.abs(cur.y - vp.y) < 0.001 &&
          Math.abs(cur.scale - vp.scale) < 0.0001
        ) {
          return s;
        }
        const file = structuredClone(s.file);
        file.viewport = vp;
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    setSelected: (id) =>
      set((s) => {
        const next = updateActiveTab(s, { selectedId: id });
        return next;
      }),

    setMultiSelected: (ids) =>
      set((s) => {
        const uniq = Array.from(new Set(ids));
        const next = updateActiveTab(s, { multiSelectedIds: uniq });
        return next;
      }),

    toggleMultiSelected: (id) =>
      set((s) => {
        const setIds = new Set(s.multiSelectedIds);
        if (setIds.has(id)) setIds.delete(id);
        else setIds.add(id);
        const arr = Array.from(setIds);
        const next = updateActiveTab(s, { multiSelectedIds: arr });
        return next;
      }),

    clearMultiSelected: () =>
      set((s) => {
        if (s.multiSelectedIds.length === 0) return s;
        const next = updateActiveTab(s, { multiSelectedIds: [] });
        return next;
      }),

    // ---------- people ----------
    addPersonAt: (x, y) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = newPerson(x, y);
        file.people[p.id] = p;
        touch(file);

        const next = updateActiveTab(s, {
          file,
          dirty: true,
          selectedId: p.id
        });
        return next;
      }),

    movePerson: (id, x, y) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[id];
        if (!p) return s;
        if (Math.abs(p.position.x - x) < 0.001 && Math.abs(p.position.y - y) < 0.001) return s;
        p.position = { x, y };
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    updatePerson: (id, patch) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[id];
        if (!p) return s;
        Object.assign(p, patch);
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    deletePerson: (id) =>
      set((s) => {
        if (!s.file.people[id]) return s;

        const file = structuredClone(s.file);
        delete file.people[id];
        file.connections = file.connections.filter((c) => c.from !== id && c.to !== id);
        touch(file);

        const nextSelected = s.selectedId === id ? null : s.selectedId;
        const nextMulti = s.multiSelectedIds.filter((x) => x !== id);
        const nextPending =
          s.pendingConnection && (s.pendingConnection.from === id || s.pendingConnection.to === id)
            ? null
            : s.pendingConnection;

        const next = updateActiveTab(s, {
          file,
          dirty: true,
          selectedId: nextSelected,
          multiSelectedIds: nextMulti,
          pendingConnection: nextPending
        });
        return next;
      }),

    deleteManyPeople: (ids) =>
      set((s) => {
        const del = new Set(ids);
        if (del.size === 0) return s;

        const file = structuredClone(s.file);
        let changed = false;

        for (const id of del) {
          if (file.people[id]) {
            delete file.people[id];
            changed = true;
          }
        }
        if (!changed) return s;

        file.connections = file.connections.filter((c) => !del.has(c.from) && !del.has(c.to));
        touch(file);

        const nextSelected = s.selectedId && del.has(s.selectedId) ? null : s.selectedId;
        const nextPending =
          s.pendingConnection && (del.has(s.pendingConnection.from) || del.has(s.pendingConnection.to))
            ? null
            : s.pendingConnection;

        const next = updateActiveTab(s, {
          file,
          dirty: true,
          selectedId: nextSelected,
          multiSelectedIds: [],
          pendingConnection: nextPending
        });
        return next;
      }),

    // ---------- photos ----------
    addPhotos: (id, photosBase64) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[id];
        if (!p) return s;
        p.photos.push(...photosBase64);
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    removePhoto: (id, index) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[id];
        if (!p) return s;
        p.photos.splice(index, 1);
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    // ---------- socials ----------
    addSocial: (id, type, value) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[id];
        if (!p) return s;
        p.socials.push({ id: uuid(), type: type ?? "", value: value ?? "" });
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    updateSocial: (personId, socialId, patch) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[personId];
        if (!p) return s;
        const item = p.socials.find((x) => x.id === socialId);
        if (!item) return s;
        Object.assign(item, patch);
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    removeSocial: (personId, socialId) =>
      set((s) => {
        const file = structuredClone(s.file);
        const p = file.people[personId];
        if (!p) return s;
        p.socials = p.socials.filter((x) => x.id !== socialId);
        touch(file);
        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      }),

    // ---------- connections ----------
    setPendingConnection: (from, to) =>
      set((s) => {
        const next = updateActiveTab(s, { pendingConnection: { from, to } });
        return next;
      }),

    clearPendingConnection: () =>
      set((s) => {
        const next = updateActiveTab(s, { pendingConnection: null });
        return next;
      }),

    connectionExistsBetween: (a, b) => existsBetween(get().file.connections, a, b),

    addConnection: (from, to, kind, role) =>
      set((s) => {
        const file = structuredClone(s.file);
        if (!file.people[from] || !file.people[to]) return s;
        if (existsBetween(file.connections, from, to)) return s;

        const c: Connection = {
          id: uuid(),
          from,
          to,
          kind,
          ...(kind === "family" ? { familyRole: role } : {}),
          color: connectionColor(kind, role)
        };

        file.connections.push(c);
        touch(file);

        const next = updateActiveTab(s, { file, dirty: true });
        return next;
      })
  };
});
