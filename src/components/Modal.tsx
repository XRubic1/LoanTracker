interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="panel-surface rounded-xl p-5 w-[440px] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-sm font-semibold mb-3 tracking-tight">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
