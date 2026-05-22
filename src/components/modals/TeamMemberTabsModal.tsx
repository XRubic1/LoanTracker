import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import {
  ASSIGNABLE_PAGE_IDS,
  PAGE_LABELS,
  sanitizeAllowedPages,
  normalizeAllowedPages,
} from '@/lib/tabPermissions';
import type { PageId } from '@/types';

interface TeamMemberTabsModalProps {
  open: boolean;
  onClose: () => void;
  memberEmail: string;
  /** null = all assignable tabs */
  allowedPages: PageId[] | null;
  saving: boolean;
  onSave: (pages: PageId[]) => Promise<void>;
}

/** Owner configures which sidebar tabs a team member can access. */
export function TeamMemberTabsModal({
  open,
  onClose,
  memberEmail,
  allowedPages,
  saving,
  onSave,
}: TeamMemberTabsModalProps) {
  const [selected, setSelected] = useState<PageId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(normalizeAllowedPages(allowedPages));
      setError(null);
    }
  }, [open, allowedPages]);

  const toggle = (id: PageId) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pages = sanitizeAllowedPages(selected);
    if (pages.length === 0) {
      setError('Select at least one tab.');
      return;
    }
    setError(null);
    try {
      await onSave(pages);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage tabs">
      <p className="text-[13px] text-muted2 mb-4">
        Choose which tabs <span className="text-ink font-medium">{memberEmail}</span> can see.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {ASSIGNABLE_PAGE_IDS.map((id) => (
            <label
              key={id}
              className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border hover:border-accent/40 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
                className="rounded border-border text-accent focus:ring-accent/30"
              />
              <span className="text-sm text-ink">{PAGE_LABELS[id]}</span>
            </label>
          ))}
        </div>
        {error && (
          <p className="text-xs text-tag-overdue-fg">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-lg text-sm text-muted hover:text-ink border border-border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2 px-4 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
