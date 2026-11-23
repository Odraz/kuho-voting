import type { Timestamp } from 'firebase/firestore';

export type Phase = 'nomination' | 'voting' | 'results';

export const PHASES: Phase[] = ['nomination', 'voting', 'results'];

export const PHASE_LABELS: Record<Phase, string> = {
  nomination: 'Nominace filmů',
  voting: 'Hlasování',
  results: 'Výsledky',
};

/** Logged-in player – identity is the nickname (no passwords, we are friends). */
export interface Player {
  key: string;
  name: string;
}

/** One year of the film weekend, stored in `editions/{id}`. */
export interface Edition {
  id: string;
  name: string;
  year: number;
  phase: Phase;
  archived: boolean;
  plusVotes: number;
  minusVotes: number;
  winners: number;
  createdAt?: Timestamp;
}

/** `editions/{id}/movies/{movieId}` */
export interface Movie {
  id: string;
  title: string;
  link: string;
  comment: string;
  nominator: string;
  nominatorKey: string;
  createdAt?: Timestamp | null;
}

/** `editions/{id}/votes/{playerKey}` */
export interface Ballot {
  key: string;
  name: string;
  plus: string[];
  minus: string[];
  updatedAt?: Timestamp | null;
}

export interface ScoredMovie extends Movie {
  plus: number;
  minus: number;
  total: number;
  rank: number;
  voters: { name: string; type: 1 | -1 }[];
}

export interface AppConfig {
  currentEdition: string | null;
}
