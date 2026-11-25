import { Check, ChevronDown, FolderKanban, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { BoardRecord, LabelColor } from '../types/planner';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface BoardSwitcherProps {
  boards: BoardRecord[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (title: string, color: LabelColor) => void;
  onRenameBoard: (boardId: string, title: string) => void;
  onDeleteBoard: (boardId: string) => void;
}

const BOARD_COLORS: Array<{ id: LabelColor; label: string }> = [
  { id: 'blue', label: 'Синий' },
  { id: 'emerald', label: 'Зелёный' },
  { id: 'violet', label: 'Фиолетовый' },
  { id: 'amber', label: 'Янтарный' },
  { id: 'rose', label: 'Розовый' },
];

export function BoardSwitcher({
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: BoardSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState<LabelColor>('blue');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingBoardId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsCreating(false);
        setEditingBoardId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;
    onCreateBoard(clean, newColor);
    setNewTitle('');
    setNewColor('blue');
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleSubmitRename = (boardId: string) => {
    const clean = editingTitle.trim();
    if (clean) {
      onRenameBoard(boardId, clean);
    }
    setEditingBoardId(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="board-switcher-button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex items-center gap-2 px-2.5 md:px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 transition-colors max-w-[170px] sm:max-w-[220px] cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <span
          className={`w-2.5 h-2.5 rounded-xs shrink-0 ${LABEL_COLOR_META[activeBoard.color].dot}`}
          aria-hidden="true"
        />
        <span className="truncate">{activeBoard.title}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          data-testid="board-switcher-menu"
          role="dialog"
          aria-label="Выбор и создание досок"
          className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto top-24 sm:top-full sm:mt-1.5 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <FolderKanban className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              <span>Мои доски ({boards.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть список досок"
              className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {boards.map((b) => {
              const isActive = b.id === activeBoard.id;
              const isEditing = editingBoardId === b.id;

              if (isEditing) {
                return (
                  <form
                    key={b.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitRename(b.id);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg"
                  >
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      autoFocus
                      aria-label="Новое название доски"
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-blue-600 rounded focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded cursor-pointer"
                    >
                      Ок
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={b.id}
                  className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBoard(b.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left py-0.5 cursor-pointer"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-xs shrink-0 ${LABEL_COLOR_META[b.color].dot}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-xs truncate flex-1 ${
                        isActive ? 'font-semibold text-blue-700' : 'font-medium text-slate-800'
                      }`}
                    >
                      {b.title}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                      {b.state.cards.length}
                    </span>
                    {isActive && (
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBoardId(b.id);
                        setEditingTitle(b.title);
                      }}
                      aria-label={`Переименовать доску ${b.title}`}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {boards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteBoard(b.id)}
                        aria-label={`Удалить доску ${b.title}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 border-t border-slate-100 bg-slate-50/70">
            {isCreating ? (
              <form onSubmit={handleSubmitCreate} className="space-y-2.5">
                <div>
                  <label htmlFor="new-board-title" className="sr-only">
                    Название новой доски
                  </label>
                  <input
                    id="new-board-title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Например: Личные дела, Учёба..."
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Цвет доски">
                    {BOARD_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewColor(c.id)}
                        aria-label={c.label}
                        aria-checked={newColor === c.id}
                        role="radio"
                        className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer ${
                          LABEL_COLOR_META[c.id].dot
                        } ${newColor === c.id ? 'ring-2 ring-offset-1 ring-slate-900' : 'opacity-75 hover:opacity-100'}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewTitle('');
                      }}
                      className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-300 cursor-pointer"
                    >
                      Создать
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Создать новую доску</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
