import { CalendarClock, Search, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CardItem, LabelDef } from '../types/planner';
import { formatRussianShortDate, parseFlexibleDate } from '../utils/dateUtils';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardItem[];
  labels: LabelDef[];
  onSelectCard: (card: CardItem) => void;
}

export function QuickSearchModal({
  isOpen,
  onClose,
  cards,
  labels,
  onSelectCard,
}: QuickSearchModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards.slice(0, 10);
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [cards, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-start justify-center pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-search-title"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900 dark:text-slate-100">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
          <input
            id="quick-search-title"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Быстрый поиск задач по названию или описанию..."
            aria-label="Быстрый поиск задач"
            className="flex-1 text-sm bg-transparent border-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть поиск"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Задач не найдено по запросу «{query}»
            </div>
          ) : (
            results.map((card) => {
              const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    onSelectCard(card);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex flex-col gap-1 cursor-pointer group"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {card.title}
                  </div>
                  {card.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {card.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {card.startDate && (
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                        <CalendarClock className="w-3 h-3" />
                        <span>{formatRussianShortDate(parseFlexibleDate(card.startDate))}</span>
                      </span>
                    )}
                    {cardLabels.map((lbl) => (
                      <span key={lbl.id} className="inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>{lbl.name}</span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Нажмите Esc для закрытия</span>
          <span className="font-mono">{results.length} задач</span>
        </div>
      </div>
    </div>
  );
}
