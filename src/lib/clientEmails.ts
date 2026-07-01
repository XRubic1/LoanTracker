import type { Client } from '@/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a stored client email field into individual addresses. */
export function parseClientEmailList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Basic email format check for a single address. */
export function isValidSingleClientEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
}

/** Validate one or more semicolon-separated email addresses. */
export function isValidClientEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const emails = parseClientEmailList(trimmed);
  if (emails.length === 0) return false;
  return emails.every(isValidSingleClientEmail);
}

/** Normalize for storage: trim each address, join with "; ". */
export function normalizeClientEmail(value: string | null | undefined): string | null {
  const emails = parseClientEmailList(value);
  return emails.length ? emails.join('; ') : null;
}

/**
 * Copy client emails to clipboard, separated by semicolons.
 * Flattens multiple addresses per client (e.g. "a@x.com; b@y.com").
 */
export async function copyClientEmails(clients: Client[]): Promise<{ copied: number; text: string }> {
  const emails = clients.flatMap((c) => parseClientEmailList(c.email));
  const text = emails.join(';');
  if (!text) {
    return { copied: 0, text: '' };
  }
  await navigator.clipboard.writeText(text);
  return { copied: emails.length, text };
}
