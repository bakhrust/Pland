import type { LabelColor, NoteBlock, NoteBlockType, NoteFolder, NotePage } from '../types/planner';

export const NOTE_ICONS = ['📝', '🚀', '💡', '📚', '✅', '📌', '🎯', '💼', '🧠', '🛠️', '📅', '🌱'] as const;

export const NOTE_BLOCK_TYPES: readonly NoteBlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'todo',
  'bullet',
  'numbered',
  'quote',
  'callout',
  'code',
  'divider',
];

export function makeNoteEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createNoteBlock(
  type: NoteBlockType = 'paragraph',
  content = '',
  options: { checked?: boolean; indent?: number; id?: string } = {}
): NoteBlock {
  return {
    id: options.id || makeNoteEntityId('blk'),
    type,
    content: type === 'divider' ? '' : content,
    checked: type === 'todo' ? Boolean(options.checked) : false,
    indent: Math.max(0, Math.min(3, Math.round(options.indent ?? 0))),
  };
}

export function createNoteFolder(payload: {
  title: string;
  parentId?: string | null;
  color?: LabelColor;
  order?: number;
}): NoteFolder {
  return {
    id: makeNoteEntityId('folder'),
    parentId: payload.parentId ?? null,
    title: payload.title.trim().slice(0, 100) || 'Новая папка',
    color: payload.color ?? 'blue',
    order: payload.order ?? 0,
  };
}

export function createNotePage(payload: {
  title?: string;
  folderId?: string | null;
  icon?: string;
  pinned?: boolean;
  order?: number;
  blocks?: NoteBlock[];
} = {}): NotePage {
  return {
    id: makeNoteEntityId('note'),
    folderId: payload.folderId ?? null,
    title: payload.title?.trim().slice(0, 200) || 'Новая заметка',
    icon: payload.icon ?? '📝',
    pinned: Boolean(payload.pinned),
    order: payload.order ?? 0,
    blocks:
      payload.blocks && payload.blocks.length > 0
        ? payload.blocks
        : [createNoteBlock('paragraph', '')],
    updatedAtMs: Date.now(),
  };
}

/**
 * Computes sequential 1-based numbers for 'numbered' blocks,
 * resetting per indentation level whenever a non-numbered block interrupts.
 */
export function computeNumberedListIndices(blocks: NoteBlock[]): Map<string, number> {
  const result = new Map<string, number>();
  const counters: Record<number, number> = {};

  for (const block of blocks) {
    if (block.type === 'numbered') {
      const level = Math.max(0, Math.min(3, block.indent || 0));
      // Reset deeper indentation counters
      for (const key of Object.keys(counters)) {
        if (Number(key) > level) {
          delete counters[Number(key)];
        }
      }
      counters[level] = (counters[level] ?? 0) + 1;
      result.set(block.id, counters[level]);
    } else {
      for (const key of Object.keys(counters)) {
        delete counters[Number(key)];
      }
    }
  }
  return result;
}

/**
 * Detects Notion-style markdown shortcuts typed at the beginning of a paragraph block.
 */
export function detectMarkdownBlockShortcut(
  rawText: string
): { type: NoteBlockType; content: string } | null {
  if (rawText === '---') {
    return { type: 'divider', content: '' };
  }
  const matchers: Array<{ prefix: string; type: NoteBlockType }> = [
    { prefix: '### ', type: 'heading3' },
    { prefix: '## ', type: 'heading2' },
    { prefix: '# ', type: 'heading1' },
    { prefix: '[] ', type: 'todo' },
    { prefix: '[ ] ', type: 'todo' },
    { prefix: '- ', type: 'bullet' },
    { prefix: '* ', type: 'bullet' },
    { prefix: '1. ', type: 'numbered' },
    { prefix: '> ', type: 'quote' },
  ];

  for (const item of matchers) {
    if (rawText.startsWith(item.prefix)) {
      return {
        type: item.type,
        content: rawText.slice(item.prefix.length),
      };
    }
  }
  return null;
}

export function getChecklistStats(blocks: NoteBlock[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const block of blocks) {
    if (block.type === 'todo') {
      total += 1;
      if (block.checked) done += 1;
    }
  }
  return { total, done };
}

export function countNoteWords(note: NotePage): number {
  const parts = [note.title, ...note.blocks.map((b) => b.content)]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length;
}

export function filterNotesByQuery(
  notes: NotePage[],
  folders: NoteFolder[],
  query: string
): NotePage[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  const folderNameMap = new Map(folders.map((f) => [f.id, f.title.toLowerCase()]));

  return notes.filter((note) => {
    if (note.title.toLowerCase().includes(q)) return true;
    if (note.folderId && folderNameMap.get(note.folderId)?.includes(q)) return true;
    return note.blocks.some((b) => b.content.toLowerCase().includes(q));
  });
}

export function getDescendantFolderIds(folders: NoteFolder[], rootId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const f of folders) {
      if (f.parentId === current && !descendants.has(f.id)) {
        descendants.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return descendants;
}

export function removeFolderAndPromoteChildren(
  folders: NoteFolder[],
  notes: NotePage[],
  folderId: string
): { folders: NoteFolder[]; notes: NotePage[] } {
  const target = folders.find((f) => f.id === folderId);
  if (!target) return { folders, notes };

  const nextFolders = folders
    .filter((f) => f.id !== folderId)
    .map((f) => (f.parentId === folderId ? { ...f, parentId: target.parentId } : f));

  const nextNotes = notes.map((n) =>
    n.folderId === folderId ? { ...n, folderId: target.parentId, updatedAtMs: Date.now() } : n
  );

  return { folders: nextFolders, notes: nextNotes };
}

export function insertBlockAfter(
  blocks: NoteBlock[],
  afterBlockId: string,
  newBlock: NoteBlock
): NoteBlock[] {
  const idx = blocks.findIndex((b) => b.id === afterBlockId);
  if (idx === -1) return [...blocks, newBlock];
  return [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];
}

export function moveBlockByOffset(
  blocks: NoteBlock[],
  blockId: string,
  delta: -1 | 1
): NoteBlock[] {
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return blocks;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= blocks.length) return blocks;
  const copy = [...blocks];
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);
  return copy;
}

export function formatNoteUpdatedTime(updatedAtMs: number, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  if (diffSec < 60) return 'только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const date = new Date(updatedAtMs);
  const now = new Date(nowMs);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (sameDay) return `сегодня, ${hh}:${mm}`;
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mo}.${date.getFullYear()}`;
}

export interface NoteGraphEdge {
  sourceId: string;
  targetId: string;
  kind: 'link' | 'folder';
}

const WIKI_LINK_RE = /\[\[([^[\]\n]{1,200})\]\]/g;

export function extractWikiLinks(note: NotePage): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const block of note.blocks) {
    if (!block.content) continue;
    WIKI_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKI_LINK_RE.exec(block.content)) !== null) {
      const raw = match[1].split('|')[0]?.trim();
      if (raw && !seen.has(raw.toLowerCase())) {
        seen.add(raw.toLowerCase());
        titles.push(raw);
      }
    }
  }
  return titles;
}

export function resolveNoteLinks(notes: NotePage[]): {
  outgoingById: Map<string, NotePage[]>;
  backlinksById: Map<string, NotePage[]>;
  linkEdges: NoteGraphEdge[];
} {
  const byTitleLower = new Map<string, NotePage>();
  for (const n of notes) {
    const key = n.title.trim().toLowerCase();
    if (key && !byTitleLower.has(key)) {
      byTitleLower.set(key, n);
    }
  }

  const outgoingById = new Map<string, NotePage[]>();
  const backlinksById = new Map<string, NotePage[]>();
  const linkEdges: NoteGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const n of notes) {
    outgoingById.set(n.id, []);
    backlinksById.set(n.id, []);
  }

  for (const source of notes) {
    const rawTargets = extractWikiLinks(source);
    const outgoing = outgoingById.get(source.id)!;
    for (const targetTitle of rawTargets) {
      const target = byTitleLower.get(targetTitle.toLowerCase());
      if (!target || target.id === source.id) continue;
      if (!outgoing.some((t) => t.id === target.id)) {
        outgoing.push(target);
      }
      const backlinks = backlinksById.get(target.id)!;
      if (!backlinks.some((s) => s.id === source.id)) {
        backlinks.push(source);
      }
      const edgeKey = `${source.id}->${target.id}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        linkEdges.push({ sourceId: source.id, targetId: target.id, kind: 'link' });
      }
    }
  }

  return { outgoingById, backlinksById, linkEdges };
}

export function sanitizeMarkdownFilename(title: string, fallback = 'note'): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120);
  const base = cleaned || fallback;
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
}

export function noteToMarkdown(note: NotePage, folderPath?: string | null): string {
  const updatedIso = new Date(note.updatedAtMs || Date.now()).toISOString();
  const safeYamlTitle = (note.title || 'Без названия').replace(/"/g, '\\"');
  const lines: string[] = [
    '---',
    `title: "${safeYamlTitle}"`,
    ...(folderPath ? [`folder: "${folderPath.replace(/"/g, '\\"')}"`] : []),
    `pinned: ${note.pinned ? 'true' : 'false'}`,
    `updated: ${updatedIso}`,
    '---',
    '',
    `# ${note.title || 'Без названия'}`,
    '',
  ];

  const numberedIndices = computeNumberedListIndices(note.blocks);

  for (const block of note.blocks) {
    const indentPrefix = '  '.repeat(Math.max(0, Math.min(3, block.indent || 0)));
    const text = block.content ?? '';

    switch (block.type) {
      case 'heading1':
        lines.push(`# ${text}`, '');
        break;
      case 'heading2':
        lines.push(`## ${text}`, '');
        break;
      case 'heading3':
        lines.push(`### ${text}`, '');
        break;
      case 'todo':
        lines.push(`${indentPrefix}- [${block.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'bullet':
        lines.push(`${indentPrefix}- ${text}`);
        break;
      case 'numbered': {
        const idx = numberedIndices.get(block.id) ?? 1;
        lines.push(`${indentPrefix}${idx}. ${text}`);
        break;
      }
      case 'quote': {
        const quoted = text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        lines.push(quoted, '');
        break;
      }
      case 'callout': {
        const calloutLines = text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        lines.push('> [!note]', calloutLines, '');
        break;
      }
      case 'code':
        lines.push('```', text, '```', '');
        break;
      case 'divider':
        lines.push('---', '');
        break;
      case 'paragraph':
      default:
        lines.push(`${indentPrefix}${text}`, '');
        break;
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

// ---------- Lightweight Pure-TS Uncompressed ZIP Builder (UTF-8) ----------
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getFolderPath(folderId: string | null, folderMap: Map<string, NoteFolder>): string {
  if (!folderId) return '';
  const parts: string[] = [];
  const seen = new Set<string>();
  let curr: string | null = folderId;
  while (curr && !seen.has(curr)) {
    seen.add(curr);
    const f = folderMap.get(curr);
    if (!f) break;
    const safeSeg = f.title.replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').trim() || 'Папка';
    parts.unshift(safeSeg);
    curr = f.parentId;
  }
  return parts.join('/');
}

export function buildNotesZipBlob(notes: NotePage[], folders: NoteFolder[]): Blob {
  const encoder = new TextEncoder();
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const usedNames = new Set<string>();

  const entries: Array<{ nameBytes: Uint8Array<ArrayBuffer>; dataBytes: Uint8Array<ArrayBuffer>; crc: number; offset: number }> = [];
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const note of notes) {
    const folderPath = getFolderPath(note.folderId, folderMap);
    const baseFilename = sanitizeMarkdownFilename(note.title, note.id);
    let fullPath = folderPath ? `${folderPath}/${baseFilename}` : baseFilename;

    if (usedNames.has(fullPath.toLowerCase())) {
      const stem = baseFilename.slice(0, -3);
      let suffix = 2;
      while (usedNames.has((folderPath ? `${folderPath}/${stem} (${suffix}).md` : `${stem} (${suffix}).md`).toLowerCase())) {
        suffix++;
      }
      fullPath = folderPath ? `${folderPath}/${stem} (${suffix}).md` : `${stem} (${suffix}).md`;
    }
    usedNames.add(fullPath.toLowerCase());

    const markdown = noteToMarkdown(note, folderPath || null);
    const nameBytes = new Uint8Array(encoder.encode(fullPath));
    const dataBytes = new Uint8Array(encoder.encode(markdown));
    const checksum = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(new ArrayBuffer(30 + nameBytes.length));
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression: store (0)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0x5421, true); // Mod date
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    entries.push({ nameBytes, dataBytes, crc: checksum, offset });
    parts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;
  }

  const centralStart = offset;
  let centralSize = 0;

  for (const entry of entries) {
    const central = new Uint8Array(new ArrayBuffer(46 + entry.nameBytes.length));
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central dir signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, entry.crc, true);
    cv.setUint32(20, entry.dataBytes.length, true);
    cv.setUint32(24, entry.dataBytes.length, true);
    cv.setUint16(28, entry.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, entry.offset, true);
    central.set(entry.nameBytes, 46);

    parts.push(central);
    centralSize += central.length;
  }

  const eocd = new Uint8Array(new ArrayBuffer(22));
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

