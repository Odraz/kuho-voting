// Pure helpers for bulk movie import (no Firebase imports, so they are easy to test).

export interface ImportRow {
  title: string;
  link: string;
  nominator: string;
  comment: string;
}

export const DEFAULT_IMPORT_NOMINATOR = 'Neuvedeno';

/** Loose title comparison: ignores case, diacritics, spaces and punctuation. */
export function normalizeTitle(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_TITLE = /^(n[aá]zev|jm[eé]no|film|title|movie)/i;

/**
 * Parses tab-separated rows (copied from Excel / Google Sheets or exported as TSV):
 *   title ⇥ link ⇥ nominator ⇥ comment
 * A header row (e.g. "Jméno filmu ⇥ csfd odkaz ⇥ …") is skipped automatically.
 */
export function parseImport(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const [title = '', link = '', nominator = '', comment = ''] = line.split('\t').map(s => s.replace(/\s+/g, ' ').trim());
    if (!title) return;
    if (index === 0 && HEADER_TITLE.test(title) && !/^https?:\/\//i.test(link)) return;
    rows.push({ title, link, nominator: nominator || DEFAULT_IMPORT_NOMINATOR, comment });
  });
  return rows;
}

/** Splits rows into new ones and ones whose title already exists (or repeats within the import). */
export function splitDuplicates(rows: ImportRow[], existingTitles: string[]) {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const fresh: ImportRow[] = [];
  const duplicates: ImportRow[] = [];
  for (const row of rows) {
    const key = normalizeTitle(row.title);
    if (seen.has(key)) duplicates.push(row);
    else { seen.add(key); fresh.push(row); }
  }
  return { fresh, duplicates };
}

/** Converts a Google Sheets link to its TSV export URL (the sheet must be shared "anyone with the link"). */
export function googleSheetTsvUrl(url: string): string | null {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) return null;
  const gid = url.match(/[#?&]gid=(\d+)/)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=tsv&gid=${gid}`;
}
