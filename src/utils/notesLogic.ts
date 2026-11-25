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
