import { AlertTriangle, X } from 'lucide-react';
import type { PendingGoogleMutation } from '../types/planner';

interface ConfirmActionModalProps {
  pending: PendingGoogleMutation | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  pending,
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!pending) return null;

  const isDelete = pending.type === 'delete';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                isDelete ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="confirm-dialog-title" className="font-display text-base font-semibold text-slate-900">
                {pending.title}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{pending.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Закрыть диалог подтверждения"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
          <div>
            <span className="text-slate-400">Календарь: </span>
            <span className="font-medium text-slate-800">{pending.calendarName}</span>
          </div>
          {pending.card && (
            <div>
              <span className="text-slate-400">Задача: </span>
              <span className="font-medium text-slate-800">{pending.card.title}</span>
            </div>
          )}
          {pending.cards && pending.cards.length > 0 && (
            <div>
              <span className="text-slate-400">Будет затронуто задач: </span>
              <span className="font-mono tabular-nums font-medium text-slate-800">
                {pending.cards.length}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
            }`}
          >
            {isSubmitting
              ? 'Выполняется...'
              : isDelete
                ? 'Удалить из Google Calendar'
                : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
