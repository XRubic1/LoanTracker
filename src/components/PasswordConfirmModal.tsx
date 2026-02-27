import { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/Modal';

/** Password required to perform delete/reverse payment actions. */
const DELETE_PAYMENTS_PASSWORD = 'Mepo4616';

interface PasswordConfirmModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user submits the correct password. */
  onSuccess: () => void;
  /** Optional short message (e.g. "Delete this loan?"). */
  message?: string;
}

/**
 * Modal that prompts for a password before allowing a destructive action.
 * onSuccess is only called when the entered password matches DELETE_PAYMENTS_PASSWORD.
 */
export function PasswordConfirmModal({
  open,
  onClose,
  onSuccess,
  message = 'This action is password protected.',
}: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === DELETE_PAYMENTS_PASSWORD) {
      setError('');
      onSuccess();
      onClose();
    } else {
      setError('Incorrect password');
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Confirm with password">
      <p className="text-[13px] text-muted2 mb-4">{message}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password-confirm" className="block text-[12px] text-muted mb-1.5">
            Password
          </label>
          <input
            ref={inputRef}
            id="password-confirm"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error && <p className="mt-1.5 text-[12px] text-red">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-lg border border-border text-[13px] font-medium text-muted2 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-[#3a7de8] transition-colors"
          >
            Confirm
          </button>
        </div>
      </form>
    </Modal>
  );
}
