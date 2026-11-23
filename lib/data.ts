'use client';

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, writeBatch, type DocumentData, type WriteBatch,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { cleanNickname, nicknameKey } from './nickname';
import { DEFAULT_IMPORT_NOMINATOR, type ImportRow } from './importParser';
import type { Ballot, Edition, Movie, Phase, Player } from './types';

// --- Collection layout -------------------------------------------------------
// config/app_state                      { currentEdition }
// editions/{id}                         Edition
// editions/{id}/movies/{movieId}        Movie
// editions/{id}/votes/{playerKey}       Ballot
// players/{playerKey}                   { name, createdAt }
// admins/{uid}                          { pin, createdAt }   (pin validated by rules)
// secrets/admin                         { pin }              (never readable by clients)
// movies/*, votes/*                     legacy 2025 data, read-only

export const paths = {
  config: () => doc(getFirebase().db, 'config', 'app_state'),
  editions: () => collection(getFirebase().db, 'editions'),
  edition: (id: string) => doc(getFirebase().db, 'editions', id),
  movies: (editionId: string) => collection(getFirebase().db, 'editions', editionId, 'movies'),
  movie: (editionId: string, movieId: string) => doc(getFirebase().db, 'editions', editionId, 'movies', movieId),
  votes: (editionId: string) => collection(getFirebase().db, 'editions', editionId, 'votes'),
  ballot: (editionId: string, key: string) => doc(getFirebase().db, 'editions', editionId, 'votes', key),
  player: (key: string) => doc(getFirebase().db, 'players', key),
  admin: (uid: string) => doc(getFirebase().db, 'admins', uid),
};

export const DEFAULT_LIMITS = { plusVotes: 7, minusVotes: 1, winners: 4 };

// --- Mappers -----------------------------------------------------------------

export function toEdition(id: string, d: DocumentData): Edition {
  return {
    id,
    name: d.name || `KUHO ${id}`,
    year: Number(d.year) || Number(id) || 0,
    phase: (['nomination', 'voting', 'results'].includes(d.phase) ? d.phase : 'nomination') as Phase,
    archived: Boolean(d.archived),
    plusVotes: Number.isFinite(d.plusVotes) ? d.plusVotes : DEFAULT_LIMITS.plusVotes,
    minusVotes: Number.isFinite(d.minusVotes) ? d.minusVotes : DEFAULT_LIMITS.minusVotes,
    winners: Number.isFinite(d.winners) ? d.winners : DEFAULT_LIMITS.winners,
    createdAt: d.createdAt,
  };
}

export function toMovie(id: string, d: DocumentData): Movie {
  return {
    id,
    title: d.title || 'Bez názvu',
    link: d.link || '',
    comment: d.comment || '',
    nominator: d.nominator || 'Anonym',
    nominatorKey: d.nominatorKey || '',
    createdAt: d.createdAt ?? null,
  };
}

export function toBallot(key: string, d: DocumentData): Ballot {
  return {
    key,
    name: d.name || key,
    plus: Array.isArray(d.plus) ? d.plus : [],
    minus: Array.isArray(d.minus) ? d.minus : [],
    updatedAt: d.updatedAt ?? null,
  };
}

// --- Players -----------------------------------------------------------------

/** Looks up a nickname. Returns the stored player if the nickname is already used. */
export async function findPlayer(rawName: string): Promise<Player | null> {
  const key = nicknameKey(rawName);
  const snap = await getDoc(paths.player(key));
  return snap.exists() ? { key, name: snap.data().name || cleanNickname(rawName) } : null;
}

export async function registerPlayer(rawName: string): Promise<Player> {
  const name = cleanNickname(rawName);
  const key = nicknameKey(name);
  await setDoc(paths.player(key), { name, createdAt: serverTimestamp() });
  return { key, name };
}

// --- Movies ------------------------------------------------------------------

export interface MovieInput { title: string; link: string; comment: string }

function normalizeMovieInput(input: MovieInput): MovieInput {
  let link = input.link.trim();
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  return {
    title: input.title.trim().slice(0, 200),
    link: link.slice(0, 500),
    comment: input.comment.trim().slice(0, 500),
  };
}

export async function addMovie(editionId: string, player: Player, input: MovieInput) {
  await addDoc(paths.movies(editionId), {
    ...normalizeMovieInput(input),
    nominator: player.name,
    nominatorKey: player.key,
    createdAt: serverTimestamp(),
  });
}

export async function updateMovie(editionId: string, movieId: string, input: MovieInput) {
  await updateDoc(paths.movie(editionId, movieId), { ...normalizeMovieInput(input) });
}

export async function deleteMovie(editionId: string, movieId: string) {
  await deleteDoc(paths.movie(editionId, movieId));
}

// --- Voting ------------------------------------------------------------------

export async function saveBallot(editionId: string, player: Player, plus: string[], minus: string[]) {
  await setDoc(paths.ballot(editionId, player.key), {
    name: player.name,
    plus,
    minus,
    updatedAt: serverTimestamp(),
  });
}

// --- Admin -------------------------------------------------------------------

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    return (await getDoc(paths.admin(uid))).exists();
  } catch {
    return false;
  }
}

/** Security rules accept the doc only when the pin matches `secrets/admin.pin`. */
export async function becomeAdmin(uid: string, pin: string) {
  await setDoc(paths.admin(uid), { pin, createdAt: serverTimestamp() });
}

export async function leaveAdmin(uid: string) {
  await deleteDoc(paths.admin(uid));
}

export async function setCurrentEdition(editionId: string) {
  await setDoc(paths.config(), { currentEdition: editionId }, { merge: true });
}

export async function createEdition(year: number, name: string, makeCurrent: boolean) {
  const id = String(year);
  const ref = paths.edition(id);
  if ((await getDoc(ref)).exists()) throw new Error(`Ročník ${id} už existuje.`);
  await setDoc(ref, {
    name: name.trim() || `KUHO ${year}`,
    year,
    phase: 'nomination',
    archived: false,
    ...DEFAULT_LIMITS,
    createdAt: serverTimestamp(),
  });
  if (makeCurrent) await setCurrentEdition(id);
}

export async function updateEdition(editionId: string, data: Partial<Omit<Edition, 'id' | 'createdAt'>>) {
  await updateDoc(paths.edition(editionId), data);
}

/** Writes already parsed (and de-duplicated) rows – see lib/importParser.ts. */
export async function importMovies(editionId: string, rows: ImportRow[]): Promise<number> {
  const batches = new Chunker();
  for (const row of rows) {
    const name = cleanNickname(row.nominator) || DEFAULT_IMPORT_NOMINATOR;
    batches.next().set(doc(paths.movies(editionId)), {
      ...normalizeMovieInput(row),
      nominator: name,
      nominatorKey: nicknameKey(name),
      createdAt: serverTimestamp(),
    });
  }
  await batches.commit();
  return batches.count;
}

export async function legacyDataExists(): Promise<boolean> {
  const snap = await getDocs(collection(getFirebase().db, 'movies'));
  return !snap.empty;
}

/**
 * Copies last year's data from the old top-level `movies` / `votes` collections
 * into `editions/{year}` and marks the edition as archived. Old data stays untouched,
 * so the migration is safe to run repeatedly (document ids are deterministic).
 */
export async function migrateLegacy(year: number): Promise<{ movies: number; ballots: number }> {
  const { db } = getFirebase();
  const editionId = String(year);
  const [moviesSnap, votesSnap] = await Promise.all([
    getDocs(collection(db, 'movies')),
    getDocs(collection(db, 'votes')),
  ]);

  const batches = new Chunker();
  const players = new Map<string, string>();

  batches.next().set(paths.edition(editionId), {
    name: `KUHO ${year}`,
    year,
    phase: 'results',
    archived: true,
    ...DEFAULT_LIMITS,
    createdAt: serverTimestamp(),
    migratedFromLegacy: true,
  });

  const movieIds = new Set<string>();
  moviesSnap.forEach(d => {
    const m = d.data();
    const nominator = cleanNickname(String(m.nominator || 'Anonym')) || 'Anonym';
    const key = nicknameKey(nominator);
    players.set(key, nominator);
    movieIds.add(d.id);
    batches.next().set(paths.movie(editionId, d.id), {
      title: String(m.title || 'Bez názvu').slice(0, 200),
      link: String(m.link || '').slice(0, 500),
      comment: String(m.comment || '').slice(0, 500),
      nominator,
      nominatorKey: key,
      createdAt: m.createdAt ?? serverTimestamp(),
    });
  });

  // Old ballots were keyed by browser session; the same person may appear twice.
  const ballots = new Map<string, { name: string; plus: Set<string>; minus: Set<string> }>();
  votesSnap.forEach(d => {
    const v = d.data();
    const name = cleanNickname(String(v.userName || '')) || `Anonym ${d.id.slice(0, 4)}`;
    const key = nicknameKey(name);
    const ballot = ballots.get(key) ?? { name, plus: new Set(), minus: new Set() };
    Object.entries((v.votes || {}) as Record<string, number>).forEach(([movieId, value]) => {
      if (!movieIds.has(movieId)) return;
      if (value === 1) ballot.plus.add(movieId);
      else if (value === -1) ballot.minus.add(movieId);
    });
    ballots.set(key, ballot);
  });

  ballots.forEach((b, key) => {
    if (!b.plus.size && !b.minus.size) return;
    players.set(key, b.name);
    batches.next().set(paths.ballot(editionId, key), {
      name: b.name,
      plus: [...b.plus],
      minus: [...b.minus].filter(id => !b.plus.has(id)),
      updatedAt: serverTimestamp(),
    });
  });

  players.forEach((name, key) => {
    batches.next().set(paths.player(key), { name, createdAt: serverTimestamp() }, { merge: true });
  });

  await batches.commit();
  return { movies: movieIds.size, ballots: [...ballots.values()].filter(b => b.plus.size || b.minus.size).length };
}

/** Splits writes into batches of max 400 operations (Firestore limit is 500). */
class Chunker {
  private batches: WriteBatch[] = [];
  private ops = 0;
  count = 0;

  next(): WriteBatch {
    if (!this.batches.length || this.ops >= 400) {
      this.batches.push(writeBatch(getFirebase().db));
      this.ops = 0;
    }
    this.ops++;
    this.count++;
    return this.batches[this.batches.length - 1];
  }

  async commit() {
    for (const b of this.batches) await b.commit();
  }
}
