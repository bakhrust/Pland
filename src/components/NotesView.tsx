import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Code2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Heading1,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Pencil,
  Plus,
  Quote,
  Search,
  Sparkles,
  Star,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { LabelColor, NoteBlock, NoteBlockType, NoteFolder, NotePage } from '../types/planner';
import {
  NOTE_ICONS,
  computeNumberedListIndices,
  countNoteWords,
  createNoteBlock,
  detectMarkdownBlockShortcut,
  filterNotesByQuery,
  formatNoteUpdatedTime,
  getChecklistStats,
  getDescendantFolderIds,
  insertBlockAfter,
  moveBlockByOffset,
} from '../utils/notesLogic';

interface NotesViewProps {
  folders: NoteFolder[];
  notes: NotePage[];
  onCreateFolder: (payload: { title: string; parentId: string | null; color: LabelColor }) => NoteFolder;
  onRenameFolder: (folderId: string, title: string, color?: LabelColor) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateNote: (payload?: { folderId?: string | null; title?: string }) => NotePage;
  onUpdateNote: (noteId: string, updater: (prev: NotePage) => NotePage) => void;
  onDeleteNote: (noteId: string) => void;
  onSeedStarterNotes: () => void;
}

interface BlockTypeOption {
  type: NoteBlockType;
  label: string;
  shortLabel: string;
  hint: string;
  keywords: string;
  Icon: typeof Type;
}

const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  { type: 'paragraph', label: 'Обычный текст', shortLabel: 'Текст', hint: 'Абзац текста', keywords: 'text paragraph текст абзац', Icon: Type },
  { type: 'heading1', label: 'Заголовок 1', shortLabel: 'H1', hint: 'Крупный раздел (# )', keywords: 'h1 heading1 заголовок', Icon: Heading1 },
  { type: 'heading2', label: 'Заголовок 2', shortLabel: 'H2', hint: 'Подраздел (## )', keywords: 'h2 heading2 заголовок', Icon: Heading2 },
  { type: 'heading3', label: 'Заголовок 3', shortLabel: 'H3', hint: 'Малый заголовок (### )', keywords: 'h3 heading3 заголовок', Icon: Heading3 },
  { type: 'todo', label: 'Список дел', shortLabel: 'Задачи', hint: 'Чекбокс с отметкой ([] )', keywords: 'todo checklist чекбокс задачи список', Icon: CheckSquare },
  { type: 'bullet', label: 'Маркированный список', shortLabel: 'Список', hint: 'Пункты с точкой (- )', keywords: 'bullet list список маркированный', Icon: List },
  { type: 'numbered', label: 'Нумерованный список', shortLabel: '1. 2. 3.', hint: 'Последовательный список (1. )', keywords: 'numbered list список нумерованный', Icon: ListOrdered },
  { type: 'quote', label: 'Цитата', shortLabel: 'Цитата', hint: 'Выделенная мысль (> )', keywords: 'quote цитата', Icon: Quote },
  { type: 'callout', label: 'Выноска / Заметка', shortLabel: 'Выноска', hint: 'Важная подсказка или фокус', keywords: 'callout note выноска подсказка', Icon: Lightbulb },
  { type: 'code', label: 'Блок кода', shortLabel: 'Код', hint: 'Моноширинный фрагмент', keywords: 'code код snippet', Icon: Code2 },
  { type: 'divider', label: 'Разделитель', shortLabel: 'Линия', hint: 'Горизонтальная линия (---)', keywords: 'divider hr line разделитель линия', Icon: Minus },
];

const FOLDER_COLOR_META: Record<
  LabelColor,
  { dot: string; text: string; bg: string; label: string }
> = {
  blue: { dot: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50', label: 'Синий' },
  emerald: { dot: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', label: 'Зелёный' },
  violet: { dot: 'bg-violet-600', text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50', label: 'Фиолетовый' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', label: 'Янтарный' },
  rose: { dot: 'bg-rose-600', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50', label: 'Малиновый' },
  slate: { dot: 'bg-slate-600', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Серый' },
};

const FOLDER_COLORS: LabelColor[] = ['blue', 'emerald', 'violet', 'amber', 'rose'];

function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  ariaLabel,
  textareaRef,
  rows = 1,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className: string;
  ariaLabel: string;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
  rows?: number;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        textareaRef?.(el);
      }}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${className}`}
    />
  );
}

export function NotesView({
  folders,
  notes,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onSeedStarterNotes,
}: NotesViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => notes[0]?.id ?? null);
  const [mobileScreen, setMobileScreen] = useState<'sidebar' | 'editor'>('sidebar');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [typeMenuBlockId, setTypeMenuBlockId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  // Inline folder creation / editing form state (avoids window.prompt inside iframes/PWA)
  const [folderForm, setFolderForm] = useState<{
    mode: 'create' | 'edit';
    folderId?: string;
    parentId: string | null;
    title: string;
    color: LabelColor;
  } | null>(null);

  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Keep selectedNoteId valid if notes list changes (e.g. deletion or cloud load)
  useEffect(() => {
    if (notes.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !notes.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  // Focus block programmatically after Enter / insertion / deletion
  const scheduleBlockFocus = (blockId: string, cursorToEnd = false) => {
    setFocusedBlockId(blockId);
    requestAnimationFrame(() => {
      const el = blockRefs.current[blockId];
      if (!el) return;
      el.focus();
      if (cursorToEnd) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  const handleOpenNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setConfirmDeleteNoteId(null);
    setSlashBlockId(null);
    setTypeMenuBlockId(null);
    setShowIconPicker(false);
    setMobileScreen('editor');
  };

  const handleCreateAndOpenNote = (folderId: string | null = null) => {
    const created = onCreateNote({ folderId });
    if (folderId) {
      setCollapsedFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
    setSelectedNoteId(created.id);
    setConfirmDeleteNoteId(null);
    setMobileScreen('editor');
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSubmitFolderForm = () => {
    if (!folderForm) return;
    const clean = folderForm.title.trim();
    if (!clean) return;
    if (folderForm.mode === 'create') {
      const created = onCreateFolder({
        title: clean,
        parentId: folderForm.parentId,
        color: folderForm.color,
      });
      if (folderForm.parentId) {
        setCollapsedFolderIds((prev) => {
          const next = new Set(prev);
          next.delete(folderForm.parentId!);
          return next;
        });
      }
      // Collapse state untouched for new folder (expanded by default)
      void created;
    } else if (folderForm.mode === 'edit' && folderForm.folderId) {
      onRenameFolder(folderForm.folderId, clean, folderForm.color);
    }
    setFolderForm(null);
  };

  const filteredNotes = useMemo(
    () => filterNotesByQuery(notes, folders, searchQuery),
    [notes, folders, searchQuery]
  );

  const pinnedNotes = useMemo(
    () => notes.filter((n) => n.pinned),
    [notes]
  );

  const folderNameMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders]
  );

  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId || !folderNameMap.has(f.parentId)),
    [folders, folderNameMap]
  );

  const unfiledNotes = useMemo(
    () => notes.filter((n) => !n.folderId || !folderNameMap.has(n.folderId)),
    [notes, folderNameMap]
  );

  const activeFolderBreadcrumb = useMemo(() => {
    if (!activeNote?.folderId) return [] as NoteFolder[];
    const chain: NoteFolder[] = [];
    const seen = new Set<string>();
    let currId: string | null = activeNote.folderId;
    while (currId && !seen.has(currId)) {
      seen.add(currId);
      const folder = folderNameMap.get(currId);
      if (!folder) break;
      chain.unshift(folder);
      currId = folder.parentId;
    }
    return chain;
  }, [activeNote, folderNameMap]);

  const numberedIndices = useMemo(
    () => (activeNote ? computeNumberedListIndices(activeNote.blocks) : new Map<string, number>()),
    [activeNote]
  );

  const checklistStats = useMemo(
    () => (activeNote ? getChecklistStats(activeNote.blocks) : { total: 0, done: 0 }),
    [activeNote]
  );

  const wordCount = useMemo(
    () => (activeNote ? countNoteWords(activeNote) : 0),
    [activeNote]
  );

  // Block mutations on activeNote
  const updateActiveBlocks = (mutator: (blocks: NoteBlock[]) => NoteBlock[]) => {
    if (!activeNote) return;
    onUpdateNote(activeNote.id, (prev) => {
      const nextBlocks = mutator(prev.blocks);
      return {
        ...prev,
        blocks: nextBlocks.length > 0 ? nextBlocks : [createNoteBlock('paragraph', '')],
        updatedAtMs: Date.now(),
      };
    });
  };

  const handleBlockContentChange = (block: NoteBlock, rawValue: string) => {
    if (!activeNote) return;

    // Check slash command menu trigger
    if (rawValue.startsWith('/') && block.type !== 'code') {
      setSlashBlockId(block.id);
    } else if (slashBlockId === block.id) {
      setSlashBlockId(null);
    }

    // Notion-style markdown auto-conversion on paragraph blocks
    if (block.type === 'paragraph') {
      const detected = detectMarkdownBlockShortcut(rawValue);
      if (detected) {
        setSlashBlockId(null);
        if (detected.type === 'divider') {
          const nextPara = createNoteBlock('paragraph', '');
          updateActiveBlocks((blocks) =>
            insertBlockAfter(
              blocks.map((b) =>
                b.id === block.id ? { ...b, type: 'divider', content: '', checked: false } : b
              ),
              block.id,
              nextPara
            )
          );
          scheduleBlockFocus(nextPara.id);
          return;
        }
        updateActiveBlocks((blocks) =>
          blocks.map((b) =>
            b.id === block.id
              ? { ...b, type: detected.type, content: detected.content, checked: false }
              : b
          )
        );
        return;
      }
    }

    updateActiveBlocks((blocks) =>
      blocks.map((b) => (b.id === block.id ? { ...b, content: rawValue } : b))
    );
  };

  const handleSelectSlashOrBlockType = (blockId: string, nextType: NoteBlockType) => {
    if (!activeNote) return;
    setSlashBlockId(null);
    setTypeMenuBlockId(null);

    if (nextType === 'divider') {
      const nextPara = createNoteBlock('paragraph', '');
      updateActiveBlocks((blocks) =>
        insertBlockAfter(
          blocks.map((b) =>
            b.id === blockId ? { ...b, type: 'divider', content: '', checked: false } : b
          ),
          blockId,
          nextPara
        )
      );
      scheduleBlockFocus(nextPara.id);
      return;
    }

    updateActiveBlocks((blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        const cleanedContent = b.content.startsWith('/') ? '' : b.content;
        return {
          ...b,
          type: nextType,
          content: cleanedContent,
          checked: nextType === 'todo' ? b.checked : false,
        };
      })
    );
    scheduleBlockFocus(blockId, true);
  };

  const handleBlockKeyDown = (block: NoteBlock, index: number, e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!activeNote) return;

    // Escape closes slash menu
    if (e.key === 'Escape' && slashBlockId === block.id) {
      e.preventDefault();
      setSlashBlockId(null);
      return;
    }

    // Tab / Shift+Tab adjusts indentation on lists and paragraphs
    if (e.key === 'Tab') {
      e.preventDefault();
      const delta = e.shiftKey ? -1 : 1;
      updateActiveBlocks((blocks) =>
        blocks.map((b) =>
          b.id === block.id
            ? { ...b, indent: Math.max(0, Math.min(3, (b.indent || 0) + delta)) }
            : b
        )
      );
      return;
    }

    // Code block keeps Enter for newlines; Mod/Shift+Enter creates next block
    if (block.type === 'code') {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        const nextBlock = createNoteBlock('paragraph', '');
        updateActiveBlocks((blocks) => insertBlockAfter(blocks, block.id, nextBlock));
        scheduleBlockFocus(nextBlock.id);
      }
      return;
    }

    // Enter creates next block (Shift+Enter inserts soft newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If slash menu is open and user presses Enter, pick the first matched option
      if (slashBlockId === block.id) {
        const query = block.content.slice(1).trim().toLowerCase();
        const matched = BLOCK_TYPE_OPTIONS.find(
          (opt) =>
            !query ||
            opt.label.toLowerCase().includes(query) ||
            opt.keywords.includes(query)
        );
        if (matched) {
          handleSelectSlashOrBlockType(block.id, matched.type);
          return;
        }
      }

      const isListType = block.type === 'bullet' || block.type === 'numbered' || block.type === 'todo';
      // Pressing Enter on an empty list item exits the list back to a paragraph (Notion behavior)
      if (isListType && block.content.trim() === '') {
        updateActiveBlocks((blocks) =>
          blocks.map((b) =>
            b.id === block.id ? { ...b, type: 'paragraph', checked: false, indent: 0 } : b
          )
        );
        return;
      }

      const nextType: NoteBlockType = isListType ? block.type : 'paragraph';
      const newBlock = createNoteBlock(nextType, '', { indent: isListType ? block.indent : 0 });
      updateActiveBlocks((blocks) => insertBlockAfter(blocks, block.id, newBlock));
      scheduleBlockFocus(newBlock.id);
      return;
    }

    // Backspace on empty block
    if (e.key === 'Backspace' && block.content === '') {
      if (block.type !== 'paragraph') {
        e.preventDefault();
        updateActiveBlocks((blocks) =>
          blocks.map((b) =>
            b.id === block.id ? { ...b, type: 'paragraph', checked: false, indent: 0 } : b
          )
        );
        return;
      }
      if (activeNote.blocks.length > 1) {
        e.preventDefault();
        const prevBlock = activeNote.blocks[index - 1];
        const nextBlock = activeNote.blocks[index + 1];
        updateActiveBlocks((blocks) => blocks.filter((b) => b.id !== block.id));
        if (prevBlock && prevBlock.type !== 'divider') {
          scheduleBlockFocus(prevBlock.id, true);
        } else if (nextBlock && nextBlock.type !== 'divider') {
          scheduleBlockFocus(nextBlock.id);
        }
      }
    }
  };

  const handleAddBlockAtEnd = (type: NoteBlockType) => {
    if (!activeNote) return;
    setSlashBlockId(null);
    if (type === 'divider') {
      const dividerBlock = createNoteBlock('divider', '');
      const paraBlock = createNoteBlock('paragraph', '');
      updateActiveBlocks((blocks) => [...blocks, dividerBlock, paraBlock]);
      scheduleBlockFocus(paraBlock.id);
      return;
    }
    const newBlock = createNoteBlock(type, '');
    updateActiveBlocks((blocks) => [...blocks, newBlock]);
    scheduleBlockFocus(newBlock.id);
  };

  // Recursive folder tree renderer
  const renderFolderTree = (parentId: string | null, depth = 0) => {
    const childFolders = folders.filter((f) => f.parentId === parentId);
    return childFolders.map((folder) => {
      const isCollapsed = collapsedFolderIds.has(folder.id);
      const folderNotes = notes.filter((n) => n.folderId === folder.id);
      const subFolders = folders.filter((f) => f.parentId === folder.id);
      const colorMeta = FOLDER_COLOR_META[folder.color] ?? FOLDER_COLOR_META.blue;
      const descendantCount = getDescendantFolderIds(folders, folder.id).size;
      const totalItems = folderNotes.length + descendantCount;

      return (
        <div key={folder.id} className="space-y-0.5">
          <div
            data-testid={`folder-row-${folder.id}`}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            className="group flex items-center justify-between gap-1 pr-1.5 py-1.5 min-h-[40px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          >
            <button
              type="button"
              onClick={() => toggleFolderCollapse(folder.id)}
              aria-expanded={!isCollapsed}
              className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              {isCollapsed ? (
                <Folder className={`w-4 h-4 shrink-0 ${colorMeta.text}`} />
              ) : (
                <FolderOpen className={`w-4 h-4 shrink-0 ${colorMeta.text}`} />
              )}
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {folder.title}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 ml-1 shrink-0">
                {totalItems}
              </span>
            </button>

            <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={() => handleCreateAndOpenNote(folder.id)}
                title="Новая заметка в папке"
                aria-label={`Новая заметка в папке ${folder.title}`}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
              </button>
              {depth < 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setFolderForm({
                      mode: 'create',
                      parentId: folder.id,
                      title: '',
                      color: folder.color,
                    })
                  }
                  title="Создать подпапку"
                  aria-label={`Создать подпапку в ${folder.title}`}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setFolderForm({
                    mode: 'edit',
                    folderId: folder.id,
                    parentId: folder.parentId,
                    title: folder.title,
                    color: folder.color,
                  })
                }
                title="Переименовать папку"
                aria-label={`Переименовать папку ${folder.title}`}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteFolder(folder.id)}
                title="Удалить папку (заметки сохранятся)"
                aria-label={`Удалить папку ${folder.title}`}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="space-y-0.5">
              {subFolders.length > 0 && renderFolderTree(folder.id, depth + 1)}
              {folderNotes.map((note) => {
                const isSelected = note.id === activeNote?.id;
                const stats = getChecklistStats(note.blocks);
                return (
                  <button
                    key={note.id}
                    type="button"
                    data-testid={`note-nav-${note.id}`}
                    onClick={() => handleOpenNote(note.id)}
                    style={{ paddingLeft: `${26 + depth * 12}px` }}
                    className={`w-full pr-2.5 py-2 min-h-[40px] rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0" aria-hidden="true">
                        {note.icon || '📝'}
                      </span>
                      <span className="text-xs truncate">{note.title || 'Без названия'}</span>
                    </span>
                    {stats.total > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                        {stats.done}/{stats.total}
                      </span>
                    )}
                  </button>
                );
              })}
              {folderNotes.length === 0 && subFolders.length === 0 && (
                <div
                  style={{ paddingLeft: `${28 + depth * 12}px` }}
                  className="py-1 text-[11px] text-slate-400 dark:text-slate-500"
                >
                  Пустая папка
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* LEFT SIDEBAR: Folders, Favorites & Notes Tree */}
      <aside
        aria-label="Навигация по заметкам и папкам"
        className={`${
          mobileScreen === 'sidebar' ? 'flex' : 'hidden'
        } md:flex w-full md:w-72 lg:w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
      >
        {/* Sidebar Top Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Блокнот
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {notes.length} стр. · {folders.length} пап.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="add-folder-button"
                onClick={() =>
                  setFolderForm({
                    mode: 'create',
                    parentId: null,
                    title: '',
                    color: 'blue',
                  })
                }
                title="Создать папку"
                aria-label="Создать папку"
                className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Папка</span>
              </button>
              <button
                type="button"
                data-testid="add-note-button"
                onClick={() => handleCreateAndOpenNote(activeNote?.folderId ?? null)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Заметка</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              data-testid="notes-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по папкам и тексту..."
              aria-label="Поиск по заметкам"
              className="w-full pl-8 pr-3 py-2 min-h-[40px] text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600"
            />
          </div>

          {/* Inline Create/Rename Folder Form */}
          {folderForm && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <span>
                  {folderForm.mode === 'create'
                    ? folderForm.parentId
                      ? 'Новая подпапка'
                      : 'Новая папка'
                    : 'Редактировать папку'}
                </span>
                <button
                  type="button"
                  onClick={() => setFolderForm(null)}
                  aria-label="Закрыть форму папки"
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                data-testid="folder-title-input"
                autoFocus
                value={folderForm.title}
                onChange={(e) => setFolderForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitFolderForm();
                  if (e.key === 'Escape') setFolderForm(null);
                }}
                placeholder="Название папки..."
                maxLength={100}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFolderForm((prev) => (prev ? { ...prev, color: c } : prev))}
                      aria-label={FOLDER_COLOR_META[c].label}
                      className={`w-5 h-5 rounded-full ${FOLDER_COLOR_META[c].dot} flex items-center justify-center cursor-pointer transition-transform ${
                        folderForm.color === c ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="folder-submit-button"
                  onClick={handleSubmitFolderForm}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {searchQuery.trim() ? (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Найдено: {filteredNotes.length}
              </div>
              {filteredNotes.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Ничего не найдено по запросу «{searchQuery}»
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const folder = note.folderId ? folderNameMap.get(note.folderId) : null;
                  const isSelected = note.id === activeNote?.id;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => handleOpenNote(note.id)}
                      className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer flex items-start gap-2 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="text-sm mt-0.5 shrink-0">{note.icon || '📝'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{note.title || 'Без названия'}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {folder ? folder.title : 'Без папки'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : notes.length === 0 && folders.length === 0 ? (
            <div className="p-4 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                В блокноте пока нет папок и заметок.
              </p>
              <button
                type="button"
                onClick={onSeedStarterNotes}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Загрузить стартовый шаблон</span>
              </button>
            </div>
          ) : (
            <>
              {/* Pinned / Favorites */}
              {pinnedNotes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Избранное
                  </div>
                  {pinnedNotes.map((note) => {
                    const isSelected = note.id === activeNote?.id;
                    return (
                      <button
                        key={`pin-${note.id}`}
                        type="button"
                        onClick={() => handleOpenNote(note.id)}
                        className={`w-full px-2.5 py-2 min-h-[40px] rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0" aria-hidden="true">
                            {note.icon || '📝'}
                          </span>
                          <span className="text-xs truncate">{note.title || 'Без названия'}</span>
                        </span>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Folders Tree */}
              {rootFolders.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Папки
                  </div>
                  {renderFolderTree(null, 0)}
                </div>
              )}

              {/* Unfiled Notes */}
              {unfiledNotes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Без папки
                  </div>
                  {unfiledNotes.map((note) => {
                    const isSelected = note.id === activeNote?.id;
                    return (
                      <button
                        key={note.id}
                        type="button"
                        data-testid={`note-nav-${note.id}`}
                        onClick={() => handleOpenNote(note.id)}
                        className={`w-full px-2.5 py-2 min-h-[40px] rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0" aria-hidden="true">
                            {note.icon || '📝'}
                          </span>
                          <span className="text-xs truncate">{note.title || 'Без названия'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* RIGHT CANVAS: Notion-style Block Editor */}
      <section
        aria-label="Редактор заметки"
        className={`${
          mobileScreen === 'editor' ? 'flex' : 'hidden'
        } md:flex flex-1 flex-col min-w-0 bg-slate-50/40 dark:bg-slate-950 overflow-hidden`}
      >
        {!activeNote ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Выберите или создайте заметку
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Организуйте страницы по папкам, собирайте чек-листы, списки, цитаты и заметки в одном месте.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleCreateAndOpenNote(null)}
                className="px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Создать заметку
              </button>
              {notes.length === 0 && (
                <button
                  type="button"
                  onClick={onSeedStarterNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Добавить готовый шаблон</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Top Editor Toolbar */}
            <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileScreen('sidebar')}
                  className="md:hidden inline-flex items-center gap-1 px-2.5 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Папки</span>
                </button>

                <nav aria-label="Путь к заметке" className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                  <span className="shrink-0">Заметки</span>
                  {activeFolderBreadcrumb.map((folder) => (
                    <span key={folder.id} className="flex items-center gap-1.5 min-w-0">
                      <span aria-hidden="true">/</span>
                      <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-300">
                        {folder.title}
                      </span>
                    </span>
                  ))}
                  <span aria-hidden="true">/</span>
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100 max-w-[220px]">
                    {activeNote.title || 'Без названия'}
                  </span>
                </nav>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Folder Mover */}
                <label className="sr-only" htmlFor="note-folder-select">
                  Папка заметки
                </label>
                <select
                  id="note-folder-select"
                  value={activeNote.folderId ?? ''}
                  onChange={(e) => {
                    const nextFolderId = e.target.value || null;
                    onUpdateNote(activeNote.id, (prev) => ({
                      ...prev,
                      folderId: nextFolderId,
                      updatedAtMs: Date.now(),
                    }));
                  }}
                  className="h-9 max-w-[130px] md:max-w-[170px] px-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="">Без папки</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>

                {/* Pin / Favorite Toggle */}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateNote(activeNote.id, (prev) => ({
                      ...prev,
                      pinned: !prev.pinned,
                      updatedAtMs: Date.now(),
                    }))
                  }
                  aria-pressed={activeNote.pinned}
                  title={activeNote.pinned ? 'Убрать из избранного' : 'В избранное'}
                  aria-label={activeNote.pinned ? 'Убрать из избранного' : 'В избранное'}
                  className={`min-h-[36px] min-w-[36px] px-2.5 rounded-lg border inline-flex items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
                    activeNote.pinned
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${activeNote.pinned ? 'fill-amber-500 text-amber-500' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="hidden lg:inline">Избранное</span>
                </button>

                {/* Delete Note (2-step inline safety) */}
                {confirmDeleteNoteId === activeNote.id ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteNote(activeNote.id);
                        setConfirmDeleteNoteId(null);
                        setMobileScreen('sidebar');
                      }}
                      className="h-9 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Удалить?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteNoteId(null)}
                      aria-label="Отменить удаление"
                      className="h-9 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteNoteId(activeNote.id)}
                    aria-label="Удалить заметку"
                    title="Удалить заметку"
                    className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </header>

            {/* Editor Document Canvas */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 py-5 md:py-9">
              <div className="max-w-3xl mx-auto space-y-5 pb-14">
                {/* Page Icon + Editable Title */}
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowIconPicker((v) => !v)}
                        aria-label="Сменить иконку страницы"
                        className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-center text-2xl cursor-pointer transition-colors shrink-0"
                      >
                        {activeNote.icon || '📝'}
                      </button>

                      {showIconPicker && (
                        <div className="absolute left-0 top-12 z-30 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg grid grid-cols-6 gap-1 w-56">
                          {NOTE_ICONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                onUpdateNote(activeNote.id, (prev) => ({
                                  ...prev,
                                  icon: emoji,
                                  updatedAtMs: Date.now(),
                                }));
                                setShowIconPicker(false);
                              }}
                              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-lg cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      data-testid="note-title-input"
                      value={activeNote.title}
                      onChange={(e) =>
                        onUpdateNote(activeNote.id, (prev) => ({
                          ...prev,
                          title: e.target.value.slice(0, 200),
                          updatedAtMs: Date.now(),
                        }))
                      }
                      placeholder="Название страницы..."
                      aria-label="Название страницы"
                      maxLength={200}
                      className="flex-1 min-w-0 font-display text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 bg-transparent focus:outline-none py-1"
                    />
                  </div>

                  {/* Quiet Inline Metadata (zero-pill discipline) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    <span>Обновлено {formatNoteUpdatedTime(activeNote.updatedAtMs)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeNote.blocks.length} бл.</span>
                    <span aria-hidden="true">·</span>
                    <span>{wordCount} сл.</span>
                    {checklistStats.total > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Чек-лист: {checklistStats.done}/{checklistStats.total}
                        </span>
                      </>
                    )}
                  </div>

                  {checklistStats.total > 0 && (
                    <div className="h-1 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-200"
                        style={{
                          width: `${Math.round((checklistStats.done / checklistStats.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Block Editor Canvas */}
                <div className="space-y-1.5" data-testid="note-blocks-container">
                  {activeNote.blocks.map((block, idx) => {
                    const indentPx = (block.indent || 0) * 20;
                    const showSlashMenu = slashBlockId === block.id;
                    const slashFilter = block.content.startsWith('/')
                      ? block.content.slice(1).trim().toLowerCase()
                      : '';
                    const filteredSlashOptions = BLOCK_TYPE_OPTIONS.filter(
                      (opt) =>
                        !slashFilter ||
                        opt.label.toLowerCase().includes(slashFilter) ||
                        opt.keywords.includes(slashFilter)
                    );
                    const isFocused = focusedBlockId === block.id;
                    const isTypeMenuOpen = typeMenuBlockId === block.id;
                    const numIndex = numberedIndices.get(block.id) ?? 1;

                    return (
                      <div
                        key={block.id}
                        data-testid={`note-block-${block.id}`}
                        style={{ paddingLeft: `${indentPx}px` }}
                        className="group relative"
                      >
                        <div className="flex items-start gap-1.5">
                          {/* Left Block Handle & Actions */}
                          <div
                            className={`flex items-center gap-0.5 pt-1 shrink-0 transition-opacity ${
                              isFocused || isTypeMenuOpen
                                ? 'opacity-100'
                                : 'opacity-65 md:opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setTypeMenuBlockId((prev) => (prev === block.id ? null : block.id))
                              }
                              title="Изменить тип блока или действия"
                              aria-label="Действия с блоком"
                              className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Main Block Content */}
                          <div className="flex-1 min-w-0">
                            {block.type === 'divider' ? (
                              <div className="py-3 flex items-center gap-2">
                                <hr className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                              </div>
                            ) : block.type === 'todo' ? (
                              <div className="flex items-start gap-2.5 py-0.5">
                                <button
                                  type="button"
                                  data-testid={`todo-checkbox-${block.id}`}
                                  role="checkbox"
                                  aria-checked={block.checked}
                                  aria-label={block.checked ? 'Снять отметку' : 'Отметить задачу'}
                                  onClick={() =>
                                    updateActiveBlocks((blocks) =>
                                      blocks.map((b) =>
                                        b.id === block.id ? { ...b, checked: !b.checked } : b
                                      )
                                    )
                                  }
                                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                    block.checked
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-blue-600'
                                  }`}
                                >
                                  {block.checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                </button>
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="Пункт списка дел..."
                                  ariaLabel="Пункт списка дел"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className={`text-sm md:text-[15px] leading-relaxed py-0.5 ${
                                    block.checked
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-800 dark:text-slate-100'
                                  }`}
                                />
                              </div>
                            ) : block.type === 'bullet' ? (
                              <div className="flex items-start gap-2.5 py-0.5">
                                <span
                                  aria-hidden="true"
                                  className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 shrink-0"
                                />
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="Пункт списка..."
                                  ariaLabel="Пункт маркированного списка"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className="text-sm md:text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 py-0.5"
                                />
                              </div>
                            ) : block.type === 'numbered' ? (
                              <div className="flex items-start gap-2 py-0.5">
                                <span
                                  aria-hidden="true"
                                  className="mt-0.5 min-w-[20px] text-xs md:text-sm font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400 shrink-0"
                                >
                                  {numIndex}.
                                </span>
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="Элемент списка..."
                                  ariaLabel="Пункт нумерованного списка"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className="text-sm md:text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 py-0.5"
                                />
                              </div>
                            ) : block.type === 'quote' ? (
                              <div className="rounded-xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-start gap-2.5 my-1">
                                <Quote className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-1 shrink-0" aria-hidden="true" />
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="Цитата или важная мысль..."
                                  ariaLabel="Цитата"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className="text-sm md:text-[15px] italic leading-relaxed text-slate-700 dark:text-slate-300"
                                />
                              </div>
                            ) : block.type === 'callout' ? (
                              <div className="rounded-xl bg-amber-50/75 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 px-3.5 py-2.5 flex items-start gap-2.5 my-1">
                                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" aria-hidden="true" />
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="Выделенная заметка..."
                                  ariaLabel="Выделенный блок"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className="text-sm leading-relaxed text-slate-800 dark:text-amber-100"
                                />
                              </div>
                            ) : block.type === 'code' ? (
                              <div className="rounded-xl bg-slate-900 dark:bg-slate-900 border border-slate-800 px-4 py-3 my-1 space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                  <span>Код</span>
                                  <span>Shift+Enter — выход</span>
                                </div>
                                <AutoTextarea
                                  value={block.content}
                                  onChange={(v) => handleBlockContentChange(block, v)}
                                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                  placeholder="// Код или команда..."
                                  ariaLabel="Блок кода"
                                  textareaRef={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  className="font-mono text-xs md:text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500"
                                />
                              </div>
                            ) : (
                              <AutoTextarea
                                value={block.content}
                                onChange={(v) => handleBlockContentChange(block, v)}
                                onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                                placeholder={
                                  block.type === 'heading1'
                                    ? 'Заголовок 1'
                                    : block.type === 'heading2'
                                    ? 'Заголовок 2'
                                    : block.type === 'heading3'
                                    ? 'Заголовок 3'
                                    : idx === activeNote.blocks.length - 1
                                    ? 'Пишите здесь или введите «/» для команд...'
                                    : 'Текст блока...'
                                }
                                ariaLabel={
                                  block.type === 'paragraph'
                                    ? 'Абзац текста'
                                    : `Заголовок (${block.type})`
                                }
                                textareaRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className={
                                  block.type === 'heading1'
                                    ? 'font-display text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 pt-3 pb-1'
                                    : block.type === 'heading2'
                                    ? 'font-display text-lg md:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 pt-2.5 pb-0.5'
                                    : block.type === 'heading3'
                                    ? 'font-display text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 pt-2 pb-0.5'
                                    : 'text-sm md:text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 py-0.5 placeholder:text-slate-400 dark:placeholder:text-slate-600'
                                }
                              />
                            )}
                          </div>
                        </div>

                        {/* Slash Command Palette */}
                        {showSlashMenu && (
                          <div
                            data-testid="slash-command-menu"
                            className="mt-1 ml-8 w-72 max-w-[calc(100%-2rem)] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-1.5 z-30 relative"
                          >
                            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Выберите тип блока
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-0.5">
                              {filteredSlashOptions.length === 0 ? (
                                <div className="px-2.5 py-2 text-xs text-slate-400">
                                  Нет подходящих блоков
                                </div>
                              ) : (
                                filteredSlashOptions.map((opt) => {
                                  const Icon = opt.Icon;
                                  return (
                                    <button
                                      key={opt.type}
                                      type="button"
                                      onClick={() => handleSelectSlashOrBlockType(block.id, opt.type)}
                                      className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left cursor-pointer transition-colors"
                                    >
                                      <span className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                                        <Icon className="w-4 h-4" />
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                                          {opt.label}
                                        </span>
                                        <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                          {opt.hint}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}

                        {/* Per-Block Context / Transform Menu */}
                        {isTypeMenuOpen && (
                          <div className="mt-1 ml-8 w-72 max-w-[calc(100%-2rem)] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-2 z-30 relative space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                Превратить блок в:
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBlocks((blocks) =>
                                      blocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, indent: Math.max(0, (b.indent || 0) - 1) }
                                          : b
                                      )
                                    )
                                  }
                                  disabled={(block.indent || 0) <= 0}
                                  title="Уменьшить отступ"
                                  aria-label="Уменьшить отступ"
                                  className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <IndentDecrease className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBlocks((blocks) =>
                                      blocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, indent: Math.min(3, (b.indent || 0) + 1) }
                                          : b
                                      )
                                    )
                                  }
                                  disabled={(block.indent || 0) >= 3}
                                  title="Увеличить отступ"
                                  aria-label="Увеличить отступ"
                                  className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <IndentIncrease className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBlocks((blocks) => moveBlockByOffset(blocks, block.id, -1))
                                  }
                                  disabled={idx === 0}
                                  title="Переместить вверх"
                                  aria-label="Переместить блок вверх"
                                  className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBlocks((blocks) => moveBlockByOffset(blocks, block.id, 1))
                                  }
                                  disabled={idx === activeNote.blocks.length - 1}
                                  title="Переместить вниз"
                                  aria-label="Переместить блок вниз"
                                  className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTypeMenuBlockId(null);
                                    updateActiveBlocks((blocks) => blocks.filter((b) => b.id !== block.id));
                                  }}
                                  title="Удалить блок"
                                  aria-label="Удалить блок"
                                  className="w-7 h-7 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/60 inline-flex items-center justify-center text-rose-600 dark:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1">
                              {BLOCK_TYPE_OPTIONS.map((opt) => {
                                const Icon = opt.Icon;
                                const active = block.type === opt.type;
                                return (
                                  <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => handleSelectSlashOrBlockType(block.id, opt.type)}
                                    className={`px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs text-left cursor-pointer transition-colors ${
                                      active
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{opt.shortLabel}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add Block Bar (works effortlessly on desktop and mobile touch) */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    Добавить блок
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BLOCK_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.Icon;
                      return (
                        <button
                          key={`quick-${opt.type}`}
                          type="button"
                          data-testid={`quick-add-${opt.type}`}
                          onClick={() => handleAddBlockAtEnd(opt.type)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{opt.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
