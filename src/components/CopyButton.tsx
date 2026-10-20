import { useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  /** Text put on the clipboard. */
  text: string;
  /** Tooltip / screen-reader label, e.g. "Copy MC". */
  label?: string;
  className?: string;
}

/** Copy text; true only when the browser really accepted it. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API blocked or page not focused: try the older selection-based copy.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

/** Small copy icon that turns into a green checkmark for a moment after copying. */
export function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    []
  );

  const copy = async (event: React.SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const ok = await copyToClipboard(text);
    if (!ok) {
      // Nothing worked (clipboard blocked): let the person copy it by hand.
      window.prompt('Copy blocked by the browser. Press Ctrl+C to copy:', text);
      return;
    }
    setCopied(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={(e) => void copy(e)}
      onKeyDown={(e) => e.stopPropagation()}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
      className={`inline-flex flex-shrink-0 items-center rounded p-0.5 transition-colors ${
        copied ? 'text-green' : 'text-muted2 hover:bg-accent/10 hover:text-accent'
      } ${className}`}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
