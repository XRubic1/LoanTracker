interface EmptyWorkspaceProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Minimal empty state for members with a loans-first workspace. */
export function EmptyWorkspace({
  title = 'Your workspace is ready',
  description = 'Start by adding your first loan. Your team admin can enable more tabs for you under Users.',
  actionLabel = 'Add your first loan',
  onAction,
}: EmptyWorkspaceProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-panel/50 px-6 py-12 text-center max-w-md mx-auto my-8">
      <p className="text-[15px] font-medium text-ink mb-2">{title}</p>
      <p className="text-[13px] text-muted2 mb-6">{description}</p>
      {onAction && (
        <button type="button" onClick={onAction} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
