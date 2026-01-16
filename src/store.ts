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
  if (kind === "acquaintance") return "#a855f7"; // purple
  if (kind === "friend") return "#38bdf8"; // blue
  if (kind === "best_friend") return "#22c55e"; // green
  // family
  if (role === "mother") return "#ef4444"; // red
  if (role === "father") return "#f59e0b"; // amber
  if (role === "brother") return "#fb923c"; // orange
  if (role === "sister") return "#f472b6"; // pink
  return "#f59e0b";
}

function existsBetween(connections: Connection[], a: string, b: string) {
  return connections.some(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a)
  );
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

  // meta safety
  file.meta.app = "Connections";
  file.meta.version = typeof file.meta.version === "number" ? file.meta.version : 1;
  file.meta.createdAt = file.meta.createdAt ?? base.meta.createdAt;
  file.meta.updatedAt = file.meta.updatedAt ?? base.meta.updatedAt;

  // viewport safety
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

    // socials normalize
    safe.socials = safe.socials
      .filter((s: any) => s && typeof s === "object")
      .map((s: any) => ({
        id: typeof s.id === "string" ? s.id : uuid(),
        type: typeof s.type === "string" ? s.type : "",
        value: typeof s.value === "string" ? s.value : ""
      }));

    file.people[id] = safe;
  }

  // connections normalize minimally
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
    // remove invalid refs
    .filter((c) => file.people[c.from] && file.people[c.to]);

  return file;
}

type StoreState = {
  file: ConnectionsFile;
  filePath: string | null;

  selectedId: string | null;
  pendingConnection: PendingConnection;

  // multi-select
  multiSelectedIds: string[];

  // file ops
  newFile: () => void;
  setFileFromDisk: (file: any, path: string) => void;
  setFilePath: (path: string | null) => void;
  setLanguage: (lang: Lang) => void;

  // viewport
  setViewport: (vp: Viewport) => void;

  // selection
  setSelected: (id: string | null) => void;

  // multi-select actions
  setMultiSelected: (ids: string[]) => void;
  toggleMultiSelected: (id: string) => void;
  clearMultiSelected: () => void;

  // people
  addPersonAt: (x: number, y: number) => void;
  movePerson: (id: string, x: number, y: number) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  deleteManyPeople: (ids: string[]) => void;

  // photos
  addPhotos: (id: string, photosBase64: string[]) => void;
  removePhoto: (id: string, index: number) => void;

  // socials
  addSocial: (id: string, type: string, value: string) => void;
  updateSocial: (personId: string, socialId: string, patch: Partial<SocialLink>) => void;
  removeSocial: (personId: string, socialId: string) => void;

  // connections
  setPendingConnection: (from: string, to: string) => void;
  clearPendingConnection: () => void;
  connectionExistsBetween: (a: string, b: string) => boolean;
  addConnection: (from: string, to: string, kind: ConnectionKind, role?: FamilyRole) => void;
};

export const useStore = create<StoreState>((set, get) => ({
  file: defaultFile("ru"),
  filePath: null,

  selectedId: null,
  pendingConnection: null,

  multiSelectedIds: [],

  newFile: () =>
    set((s) => ({
      file: defaultFile(s.file.meta.language),
      filePath: null,
      selectedId: null,
      pendingConnection: null,
      multiSelectedIds: []
    })),

  setFileFromDisk: (raw, path) => {
    const file = normalizeLoadedFile(raw);
    set(() => ({
      file,
      filePath: path,
      selectedId: null,
      pendingConnection: null,
      multiSelectedIds: []
    }));
  },

  setFilePath: (path) => set({ filePath: path }),

  setLanguage: (lang) =>
    set((s) => {
      if (s.file.meta.language === lang) return s;
      const file = structuredClone(s.file);
      file.meta.language = lang;
      touch(file);
      return { file };
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
      return { file };
    }),

  setSelected: (id) => set({ selectedId: id }),

  setMultiSelected: (ids) => {
    const uniq = Array.from(new Set(ids));
    const cur = get().multiSelectedIds;
    if (cur.length === uniq.length && cur.every((x, i) => x === uniq[i])) return;
    set({ multiSelectedIds: uniq });
  },

  toggleMultiSelected: (id) =>
    set((s) => {
      const setIds = new Set(s.multiSelectedIds);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      return { multiSelectedIds: Array.from(setIds) };
    }),

  clearMultiSelected: () => {
    const cur = get().multiSelectedIds;
    if (cur.length === 0) return;
    set({ multiSelectedIds: [] });
  },

  addPersonAt: (x, y) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = newPerson(x, y);
      file.people[p.id] = p;
      touch(file);
      return { file, selectedId: p.id };
    }),

  movePerson: (id, x, y) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[id];
      if (!p) return s;
      if (Math.abs(p.position.x - x) < 0.001 && Math.abs(p.position.y - y) < 0.001) return s;
      p.position = { x, y };
      touch(file);
      return { file };
    }),

  updatePerson: (id, patch) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[id];
      if (!p) return s;
      Object.assign(p, patch);
      touch(file);
      return { file };
    }),

  deletePerson: (id) =>
    set((s) => {
      const file = structuredClone(s.file);
      if (!file.people[id]) return s;

      delete file.people[id];
      file.connections = file.connections.filter((c) => c.from !== id && c.to !== id);
      touch(file);

      const nextSelected = s.selectedId === id ? null : s.selectedId;
      const nextMulti = s.multiSelectedIds.filter((x) => x !== id);

      return { file, selectedId: nextSelected, multiSelectedIds: nextMulti };
    }),

  deleteManyPeople: (ids) =>
    set((s) => {
      const file = structuredClone(s.file);
      const del = new Set(ids);

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

      return { file, selectedId: nextSelected, multiSelectedIds: [] };
    }),

  addPhotos: (id, photosBase64) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[id];
      if (!p) return s;
      p.photos.push(...photosBase64);
      touch(file);
      return { file };
    }),

  removePhoto: (id, index) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[id];
      if (!p) return s;
      p.photos.splice(index, 1);
      touch(file);
      return { file };
    }),

  addSocial: (id, type, value) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[id];
      if (!p) return s;
      p.socials.push({ id: uuid(), type: type ?? "", value: value ?? "" });
      touch(file);
      return { file };
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
      return { file };
    }),

  removeSocial: (personId, socialId) =>
    set((s) => {
      const file = structuredClone(s.file);
      const p = file.people[personId];
      if (!p) return s;
      p.socials = p.socials.filter((x) => x.id !== socialId);
      touch(file);
      return { file };
    }),

  setPendingConnection: (from, to) => set({ pendingConnection: { from, to } }),
  clearPendingConnection: () => set({ pendingConnection: null }),

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
      return { file };
    })
}));
