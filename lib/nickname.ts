import type { Player } from './types';

export const NICKNAME_MAX = 30;

export function cleanNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

/**
 * Turns a nickname into a stable Firestore document id.
 * "Pepa", " pepa " and "Pépa" all map to the same player.
 */
export function nicknameKey(name: string): string {
  const slug = cleanNickname(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) return slug;
  // Nickname made only of emoji / special characters – derive a deterministic id.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) | 0;
  return `p-${(hash >>> 0).toString(36)}`;
}

const STORAGE_KEY = 'kuho.player';

export function loadPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.key === 'string' && typeof parsed?.name === 'string') return parsed;
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function savePlayer(player: Player | null) {
  try {
    if (player) localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable – player just logs in again next time */
  }
}
