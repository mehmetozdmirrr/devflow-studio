interface UndoToastProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function UndoToast({ message, actionLabel, onAction }: UndoToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg"
    >
      <span className="text-text">{message}</span>
      <button
        type="button"
        onClick={onAction}
        className="font-medium text-primary-text underline-offset-2 hover:underline"
      >
        {actionLabel}
      </button>
    </div>
  );
}
