import React, { useMemo, useRef, useState, useEffect } from "react";
import Konva from "konva";
import { Stage, Layer, Group, Circle, Line, Arc, Rect, Text } from "react-konva";
import { useStore } from "./store";
import { t } from "./i18n";
import type { ConnectionKind, FamilyRole, Person, Connection } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
function isLinkish(value: string) {
  const v = value.trim();
  return v.startsWith("http://") || v.startsWith("https://");
}

type TraitSeg = { color: string; rotation: number; angle: number; opacity: number };
function traitSegments(p: Person, selected: boolean): TraitSeg[] {
  const segs: TraitSeg[] = [];
  if (p.smokes === "yes") segs.push({ color: "#ef4444", rotation: 205, angle: 85, opacity: selected ? 0.95 : 0.78 });
  if (p.uses === "yes") segs.push({ color: "#fbbf24", rotation: -25, angle: 85, opacity: selected ? 0.95 : 0.78 });
  if (p.finance === "high") segs.push({ color: "#38bdf8", rotation: 95, angle: 70, opacity: selected ? 0.85 : 0.6 });
  if (p.subculture !== "unknown") segs.push({ color: "#a78bfa", rotation: 275, angle: 70, opacity: selected ? 0.85 : 0.6 });
  return segs.slice(0, 4);
}

function connectionLabel(lang: "ru" | "en", c: Connection) {
  if (c.kind === "family") {
    const role = c.familyRole;
    if (!role) return t(lang, "family");
    const roleKey =
      role === "brother" ? "brother" :
      role === "sister" ? "sister" :
      role === "mother" ? "mother" : "father";
    return `${t(lang, "family")} — ${t(lang, roleKey as any)}`;
  }
  if (c.kind === "acquaintance") return t(lang, "acquaintance");
  if (c.kind === "friend") return t(lang, "friend");
  return t(lang, "bestFriend");
}

function displayName(lang: "ru" | "en", p: Person) {
  const name = (p.name ?? "").trim();
  const sur = (p.surname ?? "").trim();
  const full = `${name} ${sur}`.trim();
  return full.length ? full : t(lang, "unknown");
}

function parseNumOrNull(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function App() {
  const file = useStore((s) => s.file);
  const filePath = useStore((s) => s.filePath);

  const setFileFromDisk = useStore((s) => s.setFileFromDisk);
  const setFilePath = useStore((s) => s.setFilePath);

  const newFile = useStore((s) => s.newFile);
  const setLanguage = useStore((s) => s.setLanguage);

  const addPersonAt = useStore((s) => s.addPersonAt);
  const movePerson = useStore((s) => s.movePerson);

  const selectedId = useStore((s) => s.selectedId);
  const setSelected = useStore((s) => s.setSelected);

  const updatePerson = useStore((s) => s.updatePerson);
  const deletePerson = useStore((s) => s.deletePerson);

  const addPhotos = useStore((s) => s.addPhotos);
  const removePhoto = useStore((s) => s.removePhoto);

  const addSocial = useStore((s) => s.addSocial);
  const updateSocial = useStore((s) => s.updateSocial);
  const removeSocial = useStore((s) => s.removeSocial);

  const pendingConnection = useStore((s) => s.pendingConnection);
  const setPendingConnection = useStore((s) => s.setPendingConnection);
  const clearPendingConnection = useStore((s) => s.clearPendingConnection);

  const connectionExistsBetween = useStore((s) => s.connectionExistsBetween);
  const addConnection = useStore((s) => s.addConnection);

  const setViewport = useStore((s) => s.setViewport);

  // multi-select
  const multiSelectedIds = useStore((s) => s.multiSelectedIds);
  const setMultiSelected = useStore((s) => s.setMultiSelected);
  const toggleMultiSelected = useStore((s) => s.toggleMultiSelected);
  const clearMultiSelected = useStore((s) => s.clearMultiSelected);
  const deleteManyPeople = useStore((s) => s.deleteManyPeople);

  const lang = file.meta.language;
  const peopleCount = Object.keys(file.people).length;
  const connectionsCount = file.connections.length;

  const selectedPerson: Person | null = selectedId ? file.people[selectedId] ?? null : null;

  const [panelOpen, setPanelOpen] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    const onCtx = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onCtx);
    return () => window.removeEventListener("contextmenu", onCtx);
  }, []);

  // keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

      if (e.key === "Escape") {
        if (bulkDeleteOpen) setBulkDeleteOpen(false);
        if (!isTyping) clearMultiSelected();
      }

      if (e.key === "Delete" && !isTyping && multiSelectedIds.length > 0) {
        setBulkDeleteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [multiSelectedIds.length, bulkDeleteOpen, clearMultiSelected]);

  // canvas size
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });
  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setCanvasSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // refs
  const layerRef = useRef<Konva.Layer | null>(null);
  const worldRef = useRef<Konva.Group | null>(null);

  const nodeGroupRefs = useRef<Record<string, Konva.Group>>({});
  const bubbleRefs = useRef<Record<string, Konva.Group>>({});
  const lineRefs = useRef<Record<string, Konva.Line>>({});

  const labelGroupRefs = useRef<Record<string, Konva.Group>>({});
  const labelRectRefs = useRef<Record<string, Konva.Rect>>({});
  const labelTextRefs = useRef<Record<string, Konva.Text>>({});
  const labelSizeCache = useRef<Record<string, { w: number; h: number }>>({});

  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const marqueeRef = useRef<{ active: boolean; start: { x: number; y: number }; end: { x: number; y: number } }>({
    active: false,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 }
  });

  const draggingRef = useRef<Set<string>>(new Set());

  const fileRef = useRef(file);
  useEffect(() => {
    fileRef.current = file;
  }, [file]);

  // clear label cache only when language changes OR connections set changes
  useEffect(() => {
    labelSizeCache.current = {};
  }, [lang, connectionsCount]);

  const connById = useMemo(() => {
    const m: Record<string, (typeof file.connections)[number]> = {};
    for (const c of file.connections) m[c.id] = c;
    return m;
  }, [file.connections]);

  const adj = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of file.connections) {
      (m[c.from] ??= []).push(c.id);
      (m[c.to] ??= []).push(c.id);
    }
    return m;
  }, [file.connections]);

  function endpoint(personId: string) {
    const g = nodeGroupRefs.current[personId];
    if (!g) return null;
    const b = bubbleRefs.current[personId];
    return { x: g.x() + (b ? b.x() : 0), y: g.y() + (b ? b.y() : 0) };
  }

  function ensureLabelSize(connId: string, textValue: string) {
    if (labelSizeCache.current[connId]) return;

    const rect = labelRectRefs.current[connId];
    const text = labelTextRefs.current[connId];
    if (!rect || !text) return;

    const pad = 6;
    text.text(textValue);
    text.padding(pad);
    text.fontSize(12);
    text.fontFamily("Segoe UI Variable, Segoe UI, Arial");
    text.fill("#e5e7eb");

    const w = Math.ceil(text.getTextWidth() + pad * 2);
    const h = Math.ceil(text.getTextHeight() + pad * 2);

    rect.width(w);
    rect.height(h);
    rect.cornerRadius(10);
    rect.position({ x: -w / 2, y: -h / 2 });

    text.width(w);
    text.height(h);
    text.align("center");
    text.verticalAlign("middle");
    text.position({ x: -w / 2, y: -h / 2 });

    labelSizeCache.current[connId] = { w, h };
  }

  function updateEdgeGeometry(connId: string) {
    const c = connById[connId] ?? fileRef.current.connections.find((x) => x.id === connId);
    if (!c) return;

    const line = lineRefs.current[connId];
    const group = labelGroupRefs.current[connId];

    const a = endpoint(c.from);
    const b = endpoint(c.to);
    if (!a || !b) return;

    if (line) line.points([a.x, a.y, b.x, b.y]);

    if (group) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      const dx = b.x - a.x;
      const dy = b.y - a.y;

      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang > 90 || ang < -90) ang += 180;

      const labelText = connectionLabel(lang, c);
      ensureLabelSize(connId, labelText);

      group.position({ x: mx, y: my });
      group.rotation(ang);
    }
  }

  function updateEdgesFor(personId: string) {
    const list = adj[personId];
    if (!list || list.length === 0) return;
    for (const id of list) updateEdgeGeometry(id);
    layerRef.current?.batchDraw();
  }

  function updateAllEdges() {
    for (const c of fileRef.current.connections) updateEdgeGeometry(c.id);
    layerRef.current?.batchDraw();
  }

  useEffect(() => {
    requestAnimationFrame(() => updateAllEdges());
  }, [peopleCount, connectionsCount, lang]);

  // floating effect
  const floatEnabled = peopleCount <= 900 && connectionsCount <= 1800;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const anim = new Konva.Animation((frame) => {
      if (!floatEnabled) return;

      const time = frame?.time ?? performance.now();
      const f = fileRef.current;

      for (const id of Object.keys(f.people)) {
        const b = bubbleRefs.current[id];
        if (!b) continue;

        if (draggingRef.current.has(id)) {
          if (b.x() !== 0 || b.y() !== 0) b.position({ x: 0, y: 0 });
          continue;
        }

        const seed = hash01(id) * 10;
        const ox = Math.sin(time / 900 + seed) * 4.2;
        const oy = Math.cos(time / 980 + seed * 1.7) * 3.8;
        b.position({ x: ox, y: oy });
      }

      for (const c of f.connections) updateEdgeGeometry(c.id);
    }, layer);

    anim.start();
    return () => anim.stop();
  }, [floatEnabled, connById, lang]);

  // pan/zoom: FIX jitter -> commit viewport only if moved enough
  const panState = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  function worldFromScreen(screen: { x: number; y: number }) {
    const w = worldRef.current;
    const scale = w ? w.scaleX() : fileRef.current.viewport.scale;
    const x = w ? w.x() : fileRef.current.viewport.x;
    const y = w ? w.y() : fileRef.current.viewport.y;
    return { x: (screen.x - x) / scale, y: (screen.y - y) / scale };
  }

  function setSelectionRect(a: { x: number; y: number }, b: { x: number; y: number }) {
    const r = selectionRectRef.current;
    if (!r) return;

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);

    r.position({ x, y });
    r.size({ width: w, height: h });
    r.visible(true);
  }

  function hideSelectionRect() {
    const r = selectionRectRef.current;
    if (!r) return;
    r.visible(false);
    r.size({ width: 0, height: 0 });
  }

  function computeMarqueeSelection(a: { x: number; y: number }, b: { x: number; y: number }) {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);

    const ids: string[] = [];
    const f = fileRef.current;

    for (const id of Object.keys(f.people)) {
      const p = endpoint(id);
      if (!p) continue;
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) ids.push(id);
    }
    return ids;
  }

  function onStageMouseDown(e: any) {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (linkingFrom) return;

    const ctrl = !!e.evt.ctrlKey;

    // ctrl + drag on empty space => marquee select
    if (ctrl && e.target === stage) {
      const wpos = worldFromScreen(pointer);
      marqueeRef.current.active = true;
      marqueeRef.current.start = wpos;
      marqueeRef.current.end = wpos;
      setSelectionRect(wpos, wpos);
      layerRef.current?.batchDraw();
      return;
    }

    // normal click on empty space: clear selection states (NO viewport write)
    if (e.target === stage) {
      setSelected(null);
      if (multiSelectedIds.length > 0) clearMultiSelected();

      // start pan (but we won't commit if not moved)
      const w = worldRef.current;
      if (!w) return;
      panState.current = {
        active: true,
        moved: false,
        startX: pointer.x,
        startY: pointer.y,
        origX: w.x(),
        origY: w.y()
      };
    }
  }

  function onStageMouseMove(e: any) {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (marqueeRef.current.active) {
      const wpos = worldFromScreen(pointer);
      marqueeRef.current.end = wpos;
      setSelectionRect(marqueeRef.current.start, marqueeRef.current.end);
      layerRef.current?.batchDraw();
      return;
    }

    if (panState.current.active) {
      const w = worldRef.current;
      if (!w) return;

      const dx = pointer.x - panState.current.startX;
      const dy = pointer.y - panState.current.startY;

      if (!panState.current.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        panState.current.moved = true;
      }

      if (panState.current.moved) {
        w.position({ x: panState.current.origX + dx, y: panState.current.origY + dy });
        w.getLayer()?.batchDraw();
      }
    }

    if (linkingFrom) setLinkTo(worldFromScreen(pointer));
  }

  function onStageMouseUp() {
    if (marqueeRef.current.active) {
      marqueeRef.current.active = false;
      const a = marqueeRef.current.start;
      const b = marqueeRef.current.end;

      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);

      hideSelectionRect();

      if (w > 6 || h > 6) {
        const ids = computeMarqueeSelection(a, b);
        setMultiSelected(ids);
      }

      layerRef.current?.batchDraw();
      return;
    }

    if (panState.current.active) {
      const moved = panState.current.moved;
      panState.current.active = false;

      // commit viewport ONLY if actually moved
      if (moved) {
        const w = worldRef.current;
        if (w) setViewport({ x: w.x(), y: w.y(), scale: w.scaleX() });
      }
    }

    if (linkingFrom) {
      setLinkingFrom(null);
      setLinkTo(null);
    }
  }

  function onWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const w = worldRef.current;
    if (!w) return;

    const oldScale = w.scaleX();
    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.2, 3);

    const mousePointTo = {
      x: (pointer.x - w.x()) / oldScale,
      y: (pointer.y - w.y()) / oldScale
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    w.scale({ x: newScale, y: newScale });
    w.position(newPos);
    w.getLayer()?.batchDraw();

    setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
  }

  function resetView() {
    const w = worldRef.current;
    if (w) {
      w.position({ x: 0, y: 0 });
      w.scale({ x: 1, y: 1 });
      w.getLayer()?.batchDraw();
    }
    setViewport({ x: 0, y: 0, scale: 1 });
  }

  function fitView() {
    const arr = Object.values(fileRef.current.people);
    if (arr.length === 0) return resetView();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of arr) {
      minX = Math.min(minX, p.position.x);
      minY = Math.min(minY, p.position.y);
      maxX = Math.max(maxX, p.position.x);
      maxY = Math.max(maxY, p.position.y);
    }

    const padding = 140;
    const wWorld = (maxX - minX) + padding * 2;
    const hWorld = (maxY - minY) + padding * 2;

    const scale = clamp(Math.min(canvasSize.w / wWorld, canvasSize.h / hWorld), 0.25, 1.6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const x = canvasSize.w / 2 - cx * scale;
    const y = canvasSize.h / 2 - cy * scale;

    const w = worldRef.current;
    if (w) {
      w.position({ x, y });
      w.scale({ x: scale, y: scale });
      w.getLayer()?.batchDraw();
    }

    setViewport({ x, y, scale });
  }

  // Linking (Shift + drag)
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState<{ x: number; y: number } | null>(null);

  const [relKind, setRelKind] = useState<ConnectionKind>("acquaintance");
  const [familyRole, setFamilyRole] = useState<FamilyRole>("brother");

  useEffect(() => {
    if (pendingConnection) {
      setRelKind("acquaintance");
      setFamilyRole("brother");
    }
  }, [pendingConnection]);

  function confirmCreateConnection() {
    if (!pendingConnection) return;
    const { from, to } = pendingConnection;

    if (connectionExistsBetween(from, to)) {
      alert(t(lang, "duplicateConnection"));
      clearPendingConnection();
      return;
    }

    if (relKind === "family") addConnection(from, to, relKind, familyRole);
    else addConnection(from, to, relKind);

    clearPendingConnection();
    requestAnimationFrame(() => updateAllEdges());
  }

  // background parallax
  const parallax = useMemo(() => {
    const px = Math.round(file.viewport.x * 0.03);
    const py = Math.round(file.viewport.y * 0.03);
    return { ["--px" as any]: `${px}px`, ["--py" as any]: `${py}px` };
  }, [file.viewport.x, file.viewport.y]);

  async function openExternal(url: string) {
    if (!isLinkish(url)) return;
    await window.api.openExternal(url);
  }

  async function onOpen() {
    const res = await window.api.openFile();
    if (!res) return;
    try {
      const parsed = JSON.parse(res.data);
      if (!parsed?.meta?.app || parsed.meta.app !== "Connections") throw new Error("bad");
      setFileFromDisk(parsed, res.path);
      requestAnimationFrame(() => updateAllEdges());
    } catch {
      alert(t(lang, "invalidFile"));
    }
  }

  async function onSave() {
    const data = JSON.stringify(fileRef.current, null, 2);
    if (filePath) {
      await window.api.saveFile(filePath, data);
      return;
    }
    const p = await window.api.saveFileAs(data);
    if (p) setFilePath(p);
  }

  async function onSaveAs() {
    const data = JSON.stringify(fileRef.current, null, 2);
    const p = await window.api.saveFileAs(data);
    if (p) setFilePath(p);
  }

  const peopleArray = useMemo(() => Object.values(file.people), [file.people]);

  const namesOpacity = !showNames ? 0 : (file.viewport.scale < 0.55 ? 0 : file.viewport.scale < 0.75 ? 0.7 : 1);
  const edgeLabelOpacity = file.viewport.scale < 0.55 ? 0 : file.viewport.scale < 0.7 ? 0.6 : 1;

  const multiSet = useMemo(() => new Set(multiSelectedIds), [multiSelectedIds]);

  function tagsToString(tags: string[]) {
    return tags.join(", ");
  }
  function stringToTags(s: string) {
    return s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50);
  }

  function doBulkDelete() {
    const n = multiSelectedIds.length;
    if (n <= 0) return;
    deleteManyPeople(multiSelectedIds);
    setBulkDeleteOpen(false);
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">{t(lang, "app")}</div>

        <button className="btn" onClick={() => newFile()}>{t(lang, "new")}</button>
        <button className="btn" onClick={onOpen}>{t(lang, "open")}</button>
        <button className="btn" onClick={onSave}>{t(lang, "save")}</button>
        <button className="btn" onClick={onSaveAs}>{t(lang, "saveAs")}</button>

        <label className="check" title={t(lang, "showNames")}>
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
          <span>{t(lang, "showNames")}</span>
        </label>

        {multiSelectedIds.length > 0 && (
          <>
            <div className="stat" style={{ marginLeft: 6 }}>
              {t(lang, "selected", { n: multiSelectedIds.length })}
            </div>
            <button className="btn danger" onClick={() => setBulkDeleteOpen(true)}>
              {t(lang, "deleteSelected")}
            </button>
            <button className="btn ghost" onClick={() => clearMultiSelected()}>
              {t(lang, "clearSelection")}
            </button>
          </>
        )}

        <div className="spacer" />
        <div className="hint">{t(lang, "hintCreate")}</div>
        <div className="spacer" />

        <button className="btn ghost" onClick={() => setLanguage(lang === "ru" ? "en" : "ru")} title={t(lang, "language")}>
          {lang === "ru" ? "Русский" : "English"}
        </button>

        <div className="stat">
          {t(lang, "people")}: {peopleCount} · {t(lang, "connections")}: {connectionsCount}
        </div>
      </div>

      <div className="content">
        <div className="canvasPane" style={parallax} ref={canvasRef}>
          <button
            className={"panelToggle " + (panelOpen ? "open" : "closed")}
            title={panelOpen ? t(lang, "hidePanel") : t(lang, "showPanel")}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? "›" : "‹"}
          </button>

          <div className="canvasControls">
            <button className="ctl" title={t(lang, "zoomIn")} onClick={() => {
              const w = worldRef.current; if (!w) return;
              const ns = clamp(w.scaleX() * 1.12, 0.2, 3);
              w.scale({ x: ns, y: ns });
              w.getLayer()?.batchDraw();
              setViewport({ x: w.x(), y: w.y(), scale: ns });
            }}>＋</button>

            <button className="ctl" title={t(lang, "zoomOut")} onClick={() => {
              const w = worldRef.current; if (!w) return;
              const ns = clamp(w.scaleX() / 1.12, 0.2, 3);
              w.scale({ x: ns, y: ns });
              w.getLayer()?.batchDraw();
              setViewport({ x: w.x(), y: w.y(), scale: ns });
            }}>－</button>

            <button className="ctl" title={t(lang, "fitView")} onClick={fitView}>⤢</button>
            <button className="ctl" title={t(lang, "resetView")} onClick={resetView}>⟲</button>
          </div>

          <Stage
            width={canvasSize.w}
            height={canvasSize.h}
            onWheel={onWheel}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            onDblClick={(e) => {
              const stage = e.target.getStage();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;
              if (e.evt.ctrlKey) return;
              const wpos = worldFromScreen(pointer);
              addPersonAt(wpos.x, wpos.y);
              requestAnimationFrame(() => updateAllEdges());
            }}
          >
            <Layer ref={(r) => (layerRef.current = r)}>
              <Group ref={(r) => (worldRef.current = r)}>

                {/* selection rectangle */}
                <Rect
                  ref={(r) => (selectionRectRef.current = r)}
                  x={0}
                  y={0}
                  width={0}
                  height={0}
                  visible={false}
                  fill="rgba(167, 139, 250, 0.12)"
                  stroke="rgba(167, 139, 250, 0.7)"
                  strokeWidth={2}
                  cornerRadius={10}
                  listening={false}
                />

                {/* edges + labels */}
                {file.connections.map((c) => {
                  const a = file.people[c.from];
                  const b = file.people[c.to];
                  if (!a || !b) return null;

                  const labelText = connectionLabel(lang, c);

                  return (
                    <React.Fragment key={c.id}>
                      <Line
                        ref={(r) => {
                          if (r) lineRefs.current[c.id] = r;
                          else delete lineRefs.current[c.id];
                        }}
                        points={[a.position.x, a.position.y, b.position.x, b.position.y]}
                        stroke={c.color}
                        strokeWidth={3}
                        lineCap="round"
                        opacity={0.92}
                        shadowColor="black"
                        shadowBlur={10}
                        shadowOpacity={0.18}
                        perfectDrawEnabled={false}
                      />

                      <Group
                        ref={(r) => {
                          if (r) labelGroupRefs.current[c.id] = r;
                          else delete labelGroupRefs.current[c.id];
                        }}
                        x={(a.position.x + b.position.x) / 2}
                        y={(a.position.y + b.position.y) / 2}
                        listening={false}
                        opacity={edgeLabelOpacity}
                      >
                        <Rect
                          ref={(r) => {
                            if (r) labelRectRefs.current[c.id] = r;
                            else delete labelRectRefs.current[c.id];
                          }}
                          fill="rgba(17, 24, 39, 0.72)"
                          stroke="rgba(255,255,255,0.14)"
                          strokeWidth={1}
                          cornerRadius={10}
                          shadowColor="black"
                          shadowBlur={14}
                          shadowOpacity={0.25}
                        />
                        <Text
                          ref={(r) => {
                            if (r) labelTextRefs.current[c.id] = r;
                            else delete labelTextRefs.current[c.id];
                          }}
                          text={labelText}
                          fontSize={12}
                          fill="#e5e7eb"
                          fontFamily={"Segoe UI Variable, Segoe UI, Arial"}
                        />
                      </Group>
                    </React.Fragment>
                  );
                })}

                {/* temp link line */}
                {linkingFrom && linkTo && (() => {
                  const a = endpoint(linkingFrom);
                  if (!a) return null;
                  return (
                    <Line
                      points={[a.x, a.y, linkTo.x, linkTo.y]}
                      stroke="#9ca3af"
                      strokeWidth={2}
                      dash={[8, 6]}
                      lineCap="round"
                      opacity={0.9}
                      perfectDrawEnabled={false}
                    />
                  );
                })()}

                {/* nodes */}
                {peopleArray.map((p) => {
                  const isSelected = p.id === selectedId;
                  const isMulti = multiSet.has(p.id);
                  const segs = traitSegments(p, isSelected);

                  return (
                    <Group
                      key={p.id}
                      x={p.position.x}
                      y={p.position.y}
                      draggable={!linkingFrom}
                      ref={(r) => {
                        if (r) nodeGroupRefs.current[p.id] = r;
                        else delete nodeGroupRefs.current[p.id];
                      }}
                      onClick={(e) => {
                        if (e.evt.ctrlKey) {
                          toggleMultiSelected(p.id);
                          setSelected(p.id);
                          return;
                        }
                        if (multiSelectedIds.length > 0) clearMultiSelected();
                        setSelected(p.id);
                      }}
                      onMouseEnter={() => (document.body.style.cursor = "pointer")}
                      onMouseLeave={() => (document.body.style.cursor = "default")}
                      onDragStart={() => {
                        draggingRef.current.add(p.id);
                        const b = bubbleRefs.current[p.id];
                        if (b) b.position({ x: 0, y: 0 });
                      }}
                      onDragMove={() => updateEdgesFor(p.id)}
                      onDragEnd={(e) => {
                        draggingRef.current.delete(p.id);
                        movePerson(p.id, e.target.x(), e.target.y());
                        requestAnimationFrame(() => updateEdgesFor(p.id));
                      }}
                    >
                      <Text
                        text={displayName(lang, p)}
                        x={-80}
                        y={-66}
                        width={160}
                        align="center"
                        fontSize={13}
                        fill="rgba(229,231,235,0.92)"
                        opacity={namesOpacity}
                        shadowColor="black"
                        shadowBlur={10}
                        shadowOpacity={0.55}
                        listening={false}
                        perfectDrawEnabled={false}
                      />

                      <Group
                        ref={(r) => {
                          if (r) bubbleRefs.current[p.id] = r;
                          else delete bubbleRefs.current[p.id];
                        }}
                      >
                        {isMulti && (
                          <Circle
                            radius={44}
                            fill="#a78bfa"
                            opacity={0.10}
                            shadowColor="#a78bfa"
                            shadowBlur={26}
                            shadowOpacity={0.55}
                            listening={false}
                            perfectDrawEnabled={false}
                          />
                        )}

                        <Circle
                          radius={34}
                          fill="#a78bfa"
                          opacity={isSelected ? 0.22 : 0.14}
                          shadowColor="#a78bfa"
                          shadowBlur={isSelected ? 26 : 18}
                          shadowOpacity={isSelected ? 0.25 : 0.18}
                          perfectDrawEnabled={false}
                          listening={false}
                        />

                        {segs.map((s, idx) => (
                          <Arc
                            key={idx}
                            innerRadius={24}
                            outerRadius={31}
                            angle={s.angle}
                            rotation={s.rotation}
                            fill={s.color}
                            opacity={s.opacity}
                            perfectDrawEnabled={false}
                            listening={false}
                          />
                        ))}

                        <Circle
                          radius={22}
                          fill="#5b6476"
                          stroke={isMulti ? "#c4b5fd" : (isSelected ? "#e5e7eb" : "#0b1020")}
                          strokeWidth={2}
                          shadowColor={isSelected ? "#a78bfa" : "#7c3aed"}
                          shadowBlur={isSelected ? 32 : 22}
                          shadowOpacity={isSelected ? 0.42 : 0.32}
                          perfectDrawEnabled={false}
                          onMouseDown={(e) => {
                            if (e.evt.shiftKey) {
                              e.cancelBubble = true;
                              setSelected(p.id);
                              setLinkingFrom(p.id);
                              const stage = e.target.getStage();
                              const pointer = stage.getPointerPosition();
                              if (pointer) setLinkTo(worldFromScreen(pointer));
                            }
                          }}
                          onMouseUp={() => {
                            if (!linkingFrom) return;
                            if (linkingFrom !== p.id) {
                              if (connectionExistsBetween(linkingFrom, p.id)) {
                                alert(t(lang, "duplicateConnection"));
                              } else {
                                setPendingConnection(linkingFrom, p.id);
                              }
                            }
                            setLinkingFrom(null);
                            setLinkTo(null);
                          }}
                        />

                        <Circle x={-7} y={-9} radius={4.5} fill="#ffffff" opacity={0.18} listening={false} />
                      </Group>
                    </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>
        </div>

        {/* side panel */}
        <div className={"sidePane " + (panelOpen ? "" : "collapsed")}>
          {!selectedPerson ? (
            <div className="empty">
              <div className="emptyTitle">{t(lang, "selectPerson")}</div>
            </div>
          ) : (
            <div className="panel">
              <div className="panelHeader">
                <div className="panelTitle">
                  {(selectedPerson.name ?? t(lang, "unknown")) + " " + (selectedPerson.surname ?? "")}
                </div>
                <button className="btn danger" onClick={() => deletePerson(selectedPerson.id)}>
                  {t(lang, "deletePerson")}
                </button>
              </div>

              {/* photos */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "photos")}</div>
                <div className="photosRow">
                  {selectedPerson.photos.map((ph, idx) => (
                    <div className="photoCard" key={idx}>
                      <img className="photoImg" src={ph} />
                      <button className="miniBtn" onClick={() => removePhoto(selectedPerson.id, idx)}>
                        {t(lang, "remove")}
                      </button>
                    </div>
                  ))}
                </div>

                <label className="fileBtn">
                  {t(lang, "addPhotos")}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;

                      const readers = Array.from(files).map(
                        (f) =>
                          new Promise<string>((resolve, reject) => {
                            const r = new FileReader();
                            r.onload = () => resolve(String(r.result));
                            r.onerror = () => reject(new Error("read"));
                            r.readAsDataURL(f);
                          })
                      );

                      const b64 = await Promise.all(readers);
                      addPhotos(selectedPerson.id, b64);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* BASIC */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "basicSection")}</div>
                <div className="grid2">
                  <Field label={t(lang, "nameLabel")}>
                    <input className="input" value={selectedPerson.name ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { name: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "surnameLabel")}>
                    <input className="input" value={selectedPerson.surname ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { surname: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "birthdayLabel")}>
                    <input className="input" type="date" value={selectedPerson.birthday ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { birthday: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "cityLabel")}>
                    <input className="input" value={selectedPerson.city ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { city: e.target.value || null })} />
                  </Field>

                  <Field label={t(lang, "smokesLabel")}>
                    <select className="input" value={selectedPerson.smokes} onChange={(e) => updatePerson(selectedPerson.id, { smokes: e.target.value as any })}>
                      <option value="unknown">{t(lang, "unknown")}</option>
                      <option value="yes">{t(lang, "yes")}</option>
                      <option value="no">{t(lang, "no")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "usesLabel")}>
                    <select className="input" value={selectedPerson.uses} onChange={(e) => updatePerson(selectedPerson.id, { uses: e.target.value as any })}>
                      <option value="unknown">{t(lang, "unknown")}</option>
                      <option value="yes">{t(lang, "yes")}</option>
                      <option value="no">{t(lang, "no")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "orientationLabel")}>
                    <select className="input" value={selectedPerson.orientation} onChange={(e) => updatePerson(selectedPerson.id, { orientation: e.target.value as any })}>
                      <option value="unknown">{t(lang, "ori_unknown")}</option>
                      <option value="girls">{t(lang, "ori_girls")}</option>
                      <option value="boys">{t(lang, "ori_boys")}</option>
                      <option value="both">{t(lang, "ori_both")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "financeLabel")}>
                    <select className="input" value={selectedPerson.finance} onChange={(e) => updatePerson(selectedPerson.id, { finance: e.target.value as any })}>
                      <option value="unknown">{t(lang, "fin_unknown")}</option>
                      <option value="low">{t(lang, "fin_low")}</option>
                      <option value="middle">{t(lang, "fin_middle")}</option>
                      <option value="high">{t(lang, "fin_high")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "relationshipStatusLabel")}>
                    <select className="input" value={selectedPerson.relationshipStatus} onChange={(e) => updatePerson(selectedPerson.id, { relationshipStatus: e.target.value as any })}>
                      <option value="unknown">{t(lang, "rel_unknown")}</option>
                      <option value="single">{t(lang, "rel_single")}</option>
                      <option value="dating">{t(lang, "rel_dating")}</option>
                      <option value="relationship">{t(lang, "rel_relationship")}</option>
                      <option value="married">{t(lang, "rel_married")}</option>
                      <option value="complicated">{t(lang, "rel_complicated")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "subcultureLabel")}>
                    <select className="input" value={selectedPerson.subculture} onChange={(e) => updatePerson(selectedPerson.id, { subculture: e.target.value as any })}>
                      <option value="unknown">{t(lang, "sub_unknown")}</option>
                      <option value="normal">{t(lang, "sub_normal")}</option>
                      <option value="oldmoney">{t(lang, "sub_oldmoney")}</option>
                      <option value="punk">{t(lang, "sub_punk")}</option>
                      <option value="alt">{t(lang, "sub_alt")}</option>
                      <option value="goth">{t(lang, "sub_goth")}</option>
                      <option value="emo">{t(lang, "sub_emo")}</option>
                      <option value="metal">{t(lang, "sub_metal")}</option>
                      <option value="hiphop">{t(lang, "sub_hiphop")}</option>
                      <option value="raver">{t(lang, "sub_raver")}</option>
                      <option value="grunge">{t(lang, "sub_grunge")}</option>
                      <option value="skater">{t(lang, "sub_skater")}</option>
                      <option value="anime">{t(lang, "sub_anime")}</option>
                      <option value="kpop">{t(lang, "sub_kpop")}</option>
                      <option value="cyber">{t(lang, "sub_cyber")}</option>
                      <option value="streetwear">{t(lang, "sub_streetwear")}</option>
                      <option value="sport">{t(lang, "sub_sport")}</option>
                      <option value="business">{t(lang, "sub_business")}</option>
                      <option value="boho">{t(lang, "sub_boho")}</option>
                      <option value="artsy">{t(lang, "sub_artsy")}</option>
                      <option value="military">{t(lang, "sub_military")}</option>
                      <option value="skinhead">{t(lang, "sub_skinhead")}</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* APPEARANCE */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "appearanceSection")}</div>
                <div className="grid2">
                  <Field label={t(lang, "heightLabel")}>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={selectedPerson.heightCm ?? ""}
                      onChange={(e) => updatePerson(selectedPerson.id, { heightCm: parseNumOrNull(e.target.value) })}
                    />
                  </Field>
                  <Field label={t(lang, "weightLabel")}>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={selectedPerson.weightKg ?? ""}
                      onChange={(e) => updatePerson(selectedPerson.id, { weightKg: parseNumOrNull(e.target.value) })}
                    />
                  </Field>

                  <Field label={t(lang, "bodyTypeLabel")}>
                    <select className="input" value={selectedPerson.bodyType} onChange={(e) => updatePerson(selectedPerson.id, { bodyType: e.target.value as any })}>
                      <option value="unknown">{t(lang, "body_unknown")}</option>
                      <option value="slim">{t(lang, "body_slim")}</option>
                      <option value="average">{t(lang, "body_average")}</option>
                      <option value="athletic">{t(lang, "body_athletic")}</option>
                      <option value="heavy">{t(lang, "body_heavy")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "eyeColorLabel")}>
                    <select className="input" value={selectedPerson.eyeColor} onChange={(e) => updatePerson(selectedPerson.id, { eyeColor: e.target.value as any })}>
                      <option value="unknown">{t(lang, "eye_unknown")}</option>
                      <option value="brown">{t(lang, "eye_brown")}</option>
                      <option value="blue">{t(lang, "eye_blue")}</option>
                      <option value="green">{t(lang, "eye_green")}</option>
                      <option value="gray">{t(lang, "eye_gray")}</option>
                      <option value="hazel">{t(lang, "eye_hazel")}</option>
                      <option value="other">{t(lang, "eye_other")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "hairLengthLabel")}>
                    <select className="input" value={selectedPerson.hairLength} onChange={(e) => updatePerson(selectedPerson.id, { hairLength: e.target.value as any })}>
                      <option value="unknown">{t(lang, "hl_unknown")}</option>
                      <option value="short">{t(lang, "hl_short")}</option>
                      <option value="medium">{t(lang, "hl_medium")}</option>
                      <option value="long">{t(lang, "hl_long")}</option>
                      <option value="very_long">{t(lang, "hl_very_long")}</option>
                      <option value="bald">{t(lang, "hl_bald")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "hairStyleLabel")}>
                    <select className="input" value={selectedPerson.hairStyle} onChange={(e) => updatePerson(selectedPerson.id, { hairStyle: e.target.value as any })}>
                      <option value="unknown">{t(lang, "hs_unknown")}</option>
                      <option value="straight">{t(lang, "hs_straight")}</option>
                      <option value="wavy">{t(lang, "hs_wavy")}</option>
                      <option value="curly">{t(lang, "hs_curly")}</option>
                      <option value="dreads">{t(lang, "hs_dreads")}</option>
                      <option value="braids">{t(lang, "hs_braids")}</option>
                      <option value="buzzcut">{t(lang, "hs_buzzcut")}</option>
                      <option value="undercut">{t(lang, "hs_undercut")}</option>
                      <option value="other">{t(lang, "hs_other")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "hairColorLabel")}>
                    <select className="input" value={selectedPerson.hairColor} onChange={(e) => updatePerson(selectedPerson.id, { hairColor: e.target.value as any })}>
                      <option value="unknown">{t(lang, "hc_unknown")}</option>
                      <option value="blonde">{t(lang, "hc_blonde")}</option>
                      <option value="brown">{t(lang, "hc_brown")}</option>
                      <option value="black">{t(lang, "hc_black")}</option>
                      <option value="red">{t(lang, "hc_red")}</option>
                      <option value="white">{t(lang, "hc_white")}</option>
                      <option value="colored">{t(lang, "hc_colored")}</option>
                      <option value="other">{t(lang, "hc_other")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "tattoosLabel")}>
                    <select className="input" value={selectedPerson.tattoos} onChange={(e) => updatePerson(selectedPerson.id, { tattoos: e.target.value as any })}>
                      <option value="unknown">{t(lang, "unknown")}</option>
                      <option value="yes">{t(lang, "yes")}</option>
                      <option value="no">{t(lang, "no")}</option>
                    </select>
                  </Field>

                  <Field label={t(lang, "piercingLabel")}>
                    <select className="input" value={selectedPerson.piercing} onChange={(e) => updatePerson(selectedPerson.id, { piercing: e.target.value as any })}>
                      <option value="unknown">{t(lang, "unknown")}</option>
                      <option value="yes">{t(lang, "yes")}</option>
                      <option value="no">{t(lang, "no")}</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* CONTACTS */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "contactsSection")}</div>
                <div className="grid2">
                  <Field label={t(lang, "phoneLabel")}>
                    <input className="input" value={selectedPerson.phone ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { phone: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "emailLabel")}>
                    <input className="input" value={selectedPerson.email ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { email: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "occupationLabel")}>
                    <input className="input" value={selectedPerson.occupation ?? ""} onChange={(e) => updatePerson(selectedPerson.id, { occupation: e.target.value || null })} />
                  </Field>
                  <Field label={t(lang, "tagsLabel")}>
                    <input
                      className="input"
                      value={tagsToString(selectedPerson.tags)}
                      onChange={(e) => updatePerson(selectedPerson.id, { tags: stringToTags(e.target.value) })}
                      placeholder={t(lang, "tagsPlaceholder")}
                    />
                  </Field>
                </div>
              </div>

              {/* Socials */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "socials")}</div>

                <div className="socialList">
                  {selectedPerson.socials.map((s) => (
                    <div className="socialRow" key={s.id}>
                      <input className="input" value={s.type} onChange={(e) => updateSocial(selectedPerson.id, s.id, { type: e.target.value })} placeholder={t(lang, "type")} />
                      <input className="input" value={s.value} onChange={(e) => updateSocial(selectedPerson.id, s.id, { value: e.target.value })} placeholder={t(lang, "value")} />
                      <button className="miniBtn" onClick={() => removeSocial(selectedPerson.id, s.id)}>{t(lang, "remove")}</button>
                    </div>
                  ))}
                </div>

                <AddSocialForm lang={lang} onAdd={(type, value) => addSocial(selectedPerson.id, type, value)} />

                {selectedPerson.socials.length > 0 && (
                  <div className="socialPreview">
                    {selectedPerson.socials.map((s) => (
                      <div key={s.id} className="socialPreviewRow">
                        <span className="muted">{s.type}:</span>{" "}
                        {isLinkish(s.value) ? (
                          <a className="link" href={s.value} onClick={(e) => { e.preventDefault(); openExternal(s.value); }}>
                            {s.value}
                          </a>
                        ) : (
                          <span className="mono clickable" onClick={() => navigator.clipboard.writeText(s.value)} title="Click to copy">
                            {s.value}
                          </span>
                        )}
                      </div>
                    ))}
                    <div className="muted tiny">({t(lang, "linksOpenExternally")})</div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="section">
                <div className="sectionTitle">{t(lang, "notes")}</div>
                <textarea className="textarea" value={selectedPerson.notes} onChange={(e) => updatePerson(selectedPerson.id, { notes: e.target.value })} placeholder="..." />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection modal */}
      {pendingConnection && (
        <div className="modalBackdrop" onMouseDown={() => clearPendingConnection()}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalTitle">{t(lang, "linkTitle")}</div>
            <div className="muted">{t(lang, "linkChoose")}</div>

            <div className="choiceRow">
              <ChoiceButton active={relKind === "acquaintance"} onClick={() => setRelKind("acquaintance")} label={t(lang, "acquaintance")} />
              <ChoiceButton active={relKind === "friend"} onClick={() => setRelKind("friend")} label={t(lang, "friend")} />
              <ChoiceButton active={relKind === "best_friend"} onClick={() => setRelKind("best_friend")} label={t(lang, "bestFriend")} />
              <ChoiceButton active={relKind === "family"} onClick={() => setRelKind("family")} label={t(lang, "family")} />
            </div>

            {relKind === "family" && (
              <>
                <div className="muted" style={{ marginTop: 10 }}>{t(lang, "chooseRole")}</div>
                <div className="choiceRow">
                  <ChoiceButton active={familyRole === "brother"} onClick={() => setFamilyRole("brother")} label={t(lang, "brother")} />
                  <ChoiceButton active={familyRole === "sister"} onClick={() => setFamilyRole("sister")} label={t(lang, "sister")} />
                  <ChoiceButton active={familyRole === "mother"} onClick={() => setFamilyRole("mother")} label={t(lang, "mother")} />
                  <ChoiceButton active={familyRole === "father"} onClick={() => setFamilyRole("father")} label={t(lang, "father")} />
                </div>
              </>
            )}

            <div className="modalActions">
              <button className="btn ghost" onClick={() => clearPendingConnection()}>{t(lang, "cancel")}</button>
              <button className="btn" onClick={confirmCreateConnection}>{t(lang, "create")}</button>
            </div>
          </div>
        </div>
      )}

      {/* bulk delete confirm */}
      {bulkDeleteOpen && (
        <div className="modalBackdrop" onMouseDown={() => setBulkDeleteOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalTitle">{t(lang, "confirmDeleteTitle")}</div>
            <div className="muted">{t(lang, "confirmDeleteBody", { n: multiSelectedIds.length })}</div>

            <div className="modalActions" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={() => setBulkDeleteOpen(false)}>{t(lang, "cancel")}</button>
              <button className="btn danger" onClick={doBulkDelete}>{t(lang, "delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <div className="label">{props.label}</div>
      {props.children}
    </label>
  );
}

function ChoiceButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button className={"choiceBtn " + (props.active ? "active" : "")} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function AddSocialForm(props: { lang: "ru" | "en"; onAdd: (type: string, value: string) => void }) {
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  return (
    <div className="addSocial">
      <input className="input" value={type} onChange={(e) => setType(e.target.value)} placeholder={t(props.lang, "type")} />
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t(props.lang, "value")} />
      <button
        className="btn"
        onClick={() => {
          if (!type.trim() && !value.trim()) return;
          props.onAdd(type, value);
          setType("");
          setValue("");
        }}
      >
        {t(props.lang, "addSocial")}
      </button>
    </div>
  );
}
