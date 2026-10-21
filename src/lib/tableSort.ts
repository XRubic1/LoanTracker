/**
 * App-wide click-to-sort for every <table>.
 * Click a column header to sort rows by that column (click again to reverse).
 * Opt a table out with the `data-no-sort` attribute. Tables whose body rows don't
 * line up one-to-one with the header cells (detail/expander rows) are left alone.
 * The chosen sort is re-applied whenever React re-renders the rows.
 */

interface SortState {
  col: number;
  dir: 'asc' | 'desc';
}

const states = new WeakMap<HTMLTableElement, SortState>();
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function cellText(cell: HTMLTableCellElement): string {
  return (cell.innerText ?? cell.textContent ?? '').trim();
}

/** Text a column is sorted on: the first line of the cell (a name, not its sub-line). */
function sortText(cell: HTMLTableCellElement): string {
  return cellText(cell).split(/\r?\n/)[0].trim();
}

/** Turn display text into something comparable: a number, a timestamp, or lowercase text. */
function sortKey(raw: string): { n: number | null; s: string } {
  const text = raw.replace(/\s+/g, ' ').trim();
  const s = text.toLowerCase();
  if (!text || text === '—' || text === '-') return { n: null, s: '' };

  // mm/dd/yyyy or yyyy-mm-dd
  const full = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) ?? null;
  if (full) return { n: new Date(+full[3], +full[1] - 1, +full[2]).getTime(), s };
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { n: new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime(), s };

  // "28 Oct" / "28 Oct 2026"
  const dm = s.match(/^(\d{1,2}) ([a-z]{3})[a-z]*(?: (\d{4}))?$/);
  if (dm && MONTHS.includes(dm[2])) {
    const year = dm[3] ? +dm[3] : new Date().getFullYear();
    return { n: new Date(year, MONTHS.indexOf(dm[2]), +dm[1]).getTime(), s };
  }

  // Leading money / number: "$21,648.56 ...", "-12.5", "42%"
  const num = text.match(/^[-+]?\$?\s?[-+]?\d[\d,]*(\.\d+)?/);
  if (num) {
    const v = parseFloat(num[0].replace(/[$,\s]/g, ''));
    if (Number.isFinite(v)) return { n: v, s };
  }
  return { n: null, s };
}

function compare(a: string, b: string): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  // Blanks always sink to the bottom handled by caller; here compare normally.
  if (ka.n != null && kb.n != null) return ka.n - kb.n;
  if (ka.n != null) return -1;
  if (kb.n != null) return 1;
  return ka.s.localeCompare(kb.s, undefined, { numeric: true, sensitivity: 'base' });
}

function isSortable(table: HTMLTableElement): boolean {
  if (table.hasAttribute('data-no-sort') || !table.tHead || table.tHead.rows.length !== 1) return false;
  const cols = table.tHead.rows[0].cells.length;
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      if (row.cells.length !== cols) return false;
      for (const cell of Array.from(row.cells)) if (cell.colSpan > 1) return false;
    }
  }
  return true;
}

function markHeaders(table: HTMLTableElement): void {
  const head = table.tHead?.rows[0];
  if (!head) return;
  const state = states.get(table);
  const sortable = isSortable(table);
  Array.from(head.cells).forEach((th, i) => {
    const ok = sortable && cellText(th) !== '';
    if (ok) {
      th.setAttribute('data-sortable', '');
      if (state && state.col === i) th.setAttribute('data-sort', state.dir);
      else th.removeAttribute('data-sort');
    } else {
      th.removeAttribute('data-sortable');
      th.removeAttribute('data-sort');
    }
  });
}

/** `data-default-sort="0:asc"` on a table sorts by that column until someone picks another. */
function ensureDefaultSort(table: HTMLTableElement): void {
  if (states.has(table) || !table.dataset.defaultSort) return;
  const [col, dir] = table.dataset.defaultSort.split(':');
  const index = Number(col);
  if (Number.isInteger(index) && index >= 0) {
    states.set(table, { col: index, dir: dir === 'desc' ? 'desc' : 'asc' });
  }
}

function applySort(table: HTMLTableElement): void {
  ensureDefaultSort(table);
  markHeaders(table);
  const state = states.get(table);
  if (!state || !isSortable(table)) return;
  const factor = state.dir === 'asc' ? 1 : -1;
  for (const body of Array.from(table.tBodies)) {
    const rows = Array.from(body.rows);
    const keyed = rows.map((row, i) => ({ row, i, text: sortText(row.cells[state.col]) }));
    keyed.sort((a, b) => {
      const ab = sortKey(a.text);
      const bb = sortKey(b.text);
      const aBlank = ab.n == null && ab.s === '';
      const bBlank = bb.n == null && bb.s === '';
      if (aBlank !== bBlank) return aBlank ? 1 : -1; // blanks last in either direction
      return compare(a.text, b.text) * factor || a.i - b.i;
    });
    if (keyed.every((k, idx) => k.row === rows[idx])) continue;
    keyed.forEach((k) => body.appendChild(k.row));
  }
}

export function installTableSort(): () => void {
  let frame = 0;
  const tablesToRefresh = new Set<HTMLTableElement>();

  const flush = () => {
    frame = 0;
    observer.disconnect();
    document.querySelectorAll('table').forEach((t) => tablesToRefresh.add(t as HTMLTableElement));
    tablesToRefresh.forEach((t) => applySort(t));
    tablesToRefresh.clear();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.closest('input, button, select, a, label')) return;
    const th = target.closest('th') as HTMLTableCellElement | null;
    if (!th || !th.hasAttribute('data-sortable')) return;
    const table = th.closest('table') as HTMLTableElement | null;
    if (!table) return;
    const prev = states.get(table);
    const col = th.cellIndex;
    states.set(table, { col, dir: prev && prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' });
    observer.disconnect();
    applySort(table);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('click', onClick);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
