import {
  ArrowUpRight,
  Focus,
  FolderTree,
  GitFork,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { LabelColor, NoteFolder, NotePage } from '../types/planner';
import { resolveNoteLinks } from '../utils/notesLogic';

interface NotesGraphViewProps {
  notes: NotePage[];
  folders: NoteFolder[];
  activeNoteId: string | null;
  onOpenNote: (noteId: string) => void;
}

interface SimNode {
  id: string;
  note: NotePage;
  folderTitle: string;
  color: string;
  radius: number;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimEdge {
  source: string;
  target: string;
  kind: 'link' | 'folder';
}

const COLOR_HEX: Record<LabelColor, string> = {
  blue: '#2563eb',
  emerald: '#059669',
  violet: '#7c3aed',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#64748b',
};

export function NotesGraphView({
  notes,
  folders,
  activeNoteId,
  onOpenNote,
}: NotesGraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [showFolderEdges, setShowFolderEdges] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [graphQuery, setGraphQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(activeNoteId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // Watch dark mode class changes on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const { outgoingById, backlinksById, linkEdges } = useMemo(
    () => resolveNoteLinks(notes),
    [notes]
  );

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const edges: SimEdge[] = linkEdges.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      kind: 'link',
    }));

    if (showFolderEdges) {
      const byFolder = new Map<string, NotePage[]>();
      for (const n of notes) {
        if (!n.folderId) continue;
        const arr = byFolder.get(n.folderId) ?? [];
        arr.push(n);
        byFolder.set(n.folderId, arr);
      }
      const existingPair = new Set(
        edges.map((e) => [e.source, e.target].sort().join('::'))
      );
      for (const group of byFolder.values()) {
        if (group.length < 2) continue;
        const hub = group[0];
        for (let i = 1; i < group.length; i++) {
          const pairKey = [hub.id, group[i].id].sort().join('::');
          if (!existingPair.has(pairKey)) {
            existingPair.add(pairKey);
            edges.push({ source: hub.id, target: group[i].id, kind: 'folder' });
          }
        }
      }
    }

    const degreeMap = new Map<string, number>();
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }

    const filtered = notes.filter((n) => showOrphans || (degreeMap.get(n.id) ?? 0) > 0);
    const filteredIds = new Set(filtered.map((n) => n.id));

    return {
      visibleNodes: filtered.map((n) => {
        const folder = n.folderId ? folderMap.get(n.folderId) : null;
        const deg = degreeMap.get(n.id) ?? 0;
        return {
          note: n,
          folderTitle: folder?.title ?? 'Без папки',
          color: folder ? COLOR_HEX[folder.color] ?? COLOR_HEX.blue : COLOR_HEX.slate,
          degree: deg,
        };
      }),
      visibleEdges: edges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target)),
    };
  }, [notes, folders, folderMap, linkEdges, showFolderEdges, showOrphans]);

  // Mutable simulation state stored in refs for 60fps canvas animation
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{
    type: 'node' | 'pan';
    nodeId?: string;
    startClientX: number;
    startClientY: number;
    startCamX: number;
    startCamY: number;
    moved: boolean;
  } | null>(null);
  const sizeRef = useRef({ width: 800, height: 600 });

  // Synchronize simulation nodes preserving existing positions when data updates
  useEffect(() => {
    const prevById = new Map(simNodesRef.current.map((sn) => [sn.id, sn]));
    const count = Math.max(1, visibleNodes.length);
    const nextNodes: SimNode[] = visibleNodes.map((item, idx) => {
      const existing = prevById.get(item.note.id);
      const angle = (idx / count) * Math.PI * 2;
      const spread = Math.min(180, 65 + count * 14);
      return {
        id: item.note.id,
        note: item.note,
        folderTitle: item.folderTitle,
        color: item.color,
        radius: 7 + Math.min(11, item.degree * 2.2),
        degree: item.degree,
        x: existing ? existing.x : Math.cos(angle) * spread,
        y: existing ? existing.y : Math.sin(angle) * spread,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
      };
    });
    simNodesRef.current = nextNodes;
    simEdgesRef.current = visibleEdges;
  }, [visibleNodes, visibleEdges]);

  // Keep refs synced with state for the canvas render loop
  const renderMetaRef = useRef({
    hoveredNodeId,
    selectedNodeId,
    activeNoteId,
    graphQuery,
    isDark,
  });
  renderMetaRef.current = {
    hoveredNodeId,
    selectedNodeId,
    activeNoteId,
    graphQuery,
    isDark,
  };

  // ResizeObserver for crisp HiDPI canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(300, Math.floor(rect.width));
      const h = Math.max(260, Math.floor(rect.height));
      sizeRef.current = { width: w, height: h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Force-directed simulation + canvas render loop
  useEffect(() => {
    let rafId = 0;

    const stepAndDraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(stepAndDraw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const { width, height } = sizeRef.current;
      const dpr = canvas.width / Math.max(1, width);
      const {
        hoveredNodeId: hoveredId,
        selectedNodeId: selectedId,
        activeNoteId: activeId,
        graphQuery: qRaw,
        isDark: dark,
      } = renderMetaRef.current;

      // 1. Physics forces (repulsion + center gravity + edge springs)
      const nCount = nodes.length;
      for (let i = 0; i < nCount; i++) {
        const a = nodes[i];
        // Centering gravity
        a.vx += -a.x * 0.0028;
        a.vy += -a.y * 0.0028;

        for (let j = i + 1; j < nCount; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(distSq);
          if (dist < 260) {
            const force = 1150 / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      for (const edge of edges) {
        const s = nodeById.get(edge.source);
        const t = nodeById.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealLen = edge.kind === 'link' ? 115 : 95;
        const k = edge.kind === 'link' ? 0.018 : 0.009;
        const force = (dist - idealLen) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      const draggedNodeId = dragRef.current?.type === 'node' ? dragRef.current.nodeId : null;
      for (const n of nodes) {
        if (n.id === draggedNodeId) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x += Math.max(-14, Math.min(14, n.vx));
        n.y += Math.max(-14, Math.min(14, n.vy));
      }

      // 2. Render frame
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clean Obsidian-inspired canvas backdrop + subtle dot grid
      ctx.fillStyle = dark ? '#020617' : '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      const cam = cameraRef.current;
      ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
      ctx.scale(cam.scale, cam.scale);

      const focusId = hoveredId || selectedId;
      const connectedToFocus = new Set<string>();
      if (focusId) {
        connectedToFocus.add(focusId);
        for (const e of edges) {
          if (e.source === focusId) connectedToFocus.add(e.target);
          if (e.target === focusId) connectedToFocus.add(e.source);
        }
      }

      const query = qRaw.trim().toLowerCase();

      // Draw edges
      for (const edge of edges) {
        const s = nodeById.get(edge.source);
        const t = nodeById.get(edge.target);
        if (!s || !t) continue;
        const isHighlighted =
          focusId && (edge.source === focusId || edge.target === focusId);

        ctx.save();
        ctx.beginPath();
        if (edge.kind === 'folder') {
          ctx.setLineDash([4, 4]);
        }
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (focusId) {
          ctx.globalAlpha = isHighlighted ? 0.9 : 0.12;
        } else {
          ctx.globalAlpha = edge.kind === 'link' ? 0.55 : 0.3;
        }

        ctx.strokeStyle = isHighlighted
          ? '#3b82f6'
          : edge.kind === 'link'
          ? dark
            ? '#64748b'
            : '#94a3b8'
          : dark
          ? '#334155'
          : '#cbd5e1';
        ctx.lineWidth = isHighlighted ? 2 / cam.scale : 1.2 / cam.scale;
        ctx.stroke();

        // Draw subtle directional arrow on wiki-link edges
        if (edge.kind === 'link') {
          const angle = Math.atan2(t.y - s.y, t.x - s.x);
          const arrowDist = t.radius + 4;
          const ax = t.x - Math.cos(angle) * arrowDist;
          const ay = t.y - Math.sin(angle) * arrowDist;
          const headLen = 6 / Math.max(0.7, Math.min(1.3, cam.scale));
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(
            ax - headLen * Math.cos(angle - Math.PI / 6),
            ay - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ax - headLen * Math.cos(angle + Math.PI / 6),
            ay - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw nodes + labels
      for (const n of nodes) {
        const matchesQuery =
          !query ||
          n.note.title.toLowerCase().includes(query) ||
          n.folderTitle.toLowerCase().includes(query);
        const isFocus = n.id === focusId;
        const isNeighbor = focusId ? connectedToFocus.has(n.id) : true;
        const dimmed = (focusId && !isNeighbor) || (query && !matchesQuery);

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.2 : 1;

        // Subtle selection halo
        if (isFocus || n.id === activeId) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = dark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(37, 99, 235, 0.16)';
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        ctx.lineWidth = isFocus ? 2.5 : 1.5;
        ctx.strokeStyle = isFocus
          ? dark
            ? '#ffffff'
            : '#0f172a'
          : dark
          ? '#0f172a'
          : '#ffffff';
        ctx.stroke();

        // Label below node
        const fontSize = Math.max(10, Math.min(13, 11.5 / Math.sqrt(cam.scale)));
        ctx.font = `${isFocus ? 600 : 500} ${fontSize}px "DM Sans", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label =
          n.note.title.length > 26 ? `${n.note.title.slice(0, 25)}…` : n.note.title;

        // Clean background halo behind label text for crisp legibility over lines
        ctx.lineWidth = 3;
        ctx.strokeStyle = dark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(248, 250, 252, 0.9)';
        ctx.strokeText(label, n.x, n.y + n.radius + 6);
        ctx.fillStyle = isFocus
          ? dark
            ? '#f8fafc'
            : '#0f172a'
          : dark
          ? '#cbd5e1'
          : '#334155';
        ctx.fillText(label, n.x, n.y + n.radius + 6);

        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(stepAndDraw);
    };

    rafId = requestAnimationFrame(stepAndDraw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Coordinate conversions
  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - rect.width / 2 - cam.x) / cam.scale,
      y: (sy - rect.height / 2 - cam.y) / cam.scale,
    };
  };

  const hitTestNode = (worldX: number, worldY: number): SimNode | null => {
    const nodes = simNodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      const hitRadius = n.radius + 8 / cameraRef.current.scale;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return n;
      }
    }
    return null;
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = hitTestNode(x, y);
    if (hit) {
      dragRef.current = {
        type: 'node',
        nodeId: hit.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCamX: cameraRef.current.x,
        startCamY: cameraRef.current.y,
        moved: false,
      };
      setSelectedNodeId(hit.id);
    } else {
      dragRef.current = {
        type: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCamX: cameraRef.current.x,
        startCamY: cameraRef.current.y,
        moved: false,
      };
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (dist > 3) drag.moved = true;

      if (drag.type === 'node' && drag.nodeId) {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        const target = simNodesRef.current.find((n) => n.id === drag.nodeId);
        if (target) {
          target.x = x;
          target.y = y;
        }
      } else if (drag.type === 'pan') {
        cameraRef.current.x = drag.startCamX + (e.clientX - drag.startClientX);
        cameraRef.current.y = drag.startCamY + (e.clientY - drag.startClientY);
      }
      return;
    }

    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = hitTestNode(x, y);
    setHoveredNodeId(hit ? hit.id : null);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.type === 'pan' && !drag.moved) {
      setSelectedNodeId(null);
    }
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    cameraRef.current.scale = Math.max(0.35, Math.min(2.6, cameraRef.current.scale * factor));
  };

  const adjustZoom = (factor: number) => {
    cameraRef.current.scale = Math.max(0.35, Math.min(2.6, cameraRef.current.scale * factor));
  };

  const resetCamera = () => {
    cameraRef.current = { x: 0, y: 0, scale: 1 };
  };

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNodeId) ?? null,
    [notes, selectedNodeId]
  );

  const selectedOutgoing = selectedNote ? outgoingById.get(selectedNote.id) ?? [] : [];
  const selectedBacklinks = selectedNote ? backlinksById.get(selectedNote.id) ?? [] : [];
  const selectedFolderTitle = selectedNote?.folderId
    ? folderMap.get(selectedNote.folderId)?.title ?? 'Без папки'
    : 'Без папки';

  return (
    <div
      data-testid="notes-graph-view"
      className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950"
    >
      {/* Graph Controls Toolbar */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={graphQuery}
              onChange={(e) => setGraphQuery(e.target.value)}
              placeholder="Подсветить на графе..."
              aria-label="Поиск узлов на графе"
              className="w-40 sm:w-52 pl-8 pr-2.5 py-1.5 min-h-[38px] text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFolderEdges((v) => !v)}
            aria-pressed={showFolderEdges}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              showFolderEdges
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Связи папок</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOrphans((v) => !v)}
            aria-pressed={showOrphans}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              showOrphans
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Одиночные</span>
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {visibleNodes.length} зам. · {visibleEdges.length} св.
          </span>
          <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => adjustZoom(0.85)}
              aria-label="Уменьшить масштаб"
              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetCamera}
              aria-label="Центрировать граф"
              title="Центрировать граф"
              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-x border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Focus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(1.18)}
              aria-label="Увеличить масштаб"
              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {visibleNodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="space-y-2 max-w-sm">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Нет узлов для отображения на графе
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Создайте заметки и свяжите их через <span className="font-mono">[[Название заметки]]</span>, чтобы увидеть карту знаний.
              </p>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            data-testid="notes-graph-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={(e) => {
              const { x, y } = screenToWorld(e.clientX, e.clientY);
              const hit = hitTestNode(x, y);
              if (hit) onOpenNote(hit.id);
            }}
            onWheel={handleWheel}
            className={`block w-full h-full touch-none ${
              hoveredNodeId ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
            }`}
          />
        )}

        {/* Selected Node Floating Card */}
        {selectedNote && (
          <div
            data-testid="graph-selected-card"
            className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-lg space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-lg shrink-0" aria-hidden="true">
                  {selectedNote.icon || '📝'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedNote.title || 'Без названия'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {selectedFolderTitle} · {selectedOutgoing.length} исх. · {selectedBacklinks.length} вход.
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-testid="graph-open-note-button"
                onClick={() => onOpenNote(selectedNote.id)}
                className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Открыть</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {(selectedOutgoing.length > 0 || selectedBacklinks.length > 0) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                {selectedOutgoing.slice(0, 4).map((t) => (
                  <button
                    key={`out-${t.id}`}
                    type="button"
                    onClick={() => setSelectedNodeId(t.id)}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[140px] cursor-pointer"
                  >
                    → {t.title}
                  </button>
                ))}
                {selectedBacklinks.slice(0, 4).map((s) => (
                  <button
                    key={`in-${s.id}`}
                    type="button"
                    onClick={() => setSelectedNodeId(s.id)}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[140px] cursor-pointer"
                  >
                    ← {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
