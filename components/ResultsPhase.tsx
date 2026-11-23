'use client';

import { useMemo } from 'react';
import { Archive, Link as LinkIcon, ThumbsDown, ThumbsUp, Trophy } from 'lucide-react';
import type { Ballot, Edition, Movie, ScoredMovie } from '@/lib/types';

interface Props {
  edition: Edition;
  movies: Movie[];
  ballots: Ballot[];
}

export function scoreMovies(movies: Movie[], ballots: Ballot[]): ScoredMovie[] {
  const byId = new Map<string, ScoredMovie>(movies.map(m => [m.id, { ...m, plus: 0, minus: 0, total: 0, rank: 0, voters: [] }]));
  for (const b of ballots) {
    for (const id of b.plus) {
      const m = byId.get(id);
      if (m) { m.plus++; m.total++; m.voters.push({ name: b.name, type: 1 }); }
    }
    for (const id of b.minus) {
      const m = byId.get(id);
      if (m) { m.minus++; m.total--; m.voters.push({ name: b.name, type: -1 }); }
    }
  }
  const scored = [...byId.values()].sort((a, b) => b.total - a.total || b.plus - a.plus || a.title.localeCompare(b.title, 'cs'));
  // Shared rank for equal score (1, 2, 2, 4 …)
  scored.forEach((m, i) => { m.rank = i > 0 && scored[i - 1].total === m.total ? scored[i - 1].rank : i + 1; });
  return scored;
}

export function ResultsPhase({ edition, movies, ballots }: Props) {
  const results = useMemo(() => scoreMovies(movies, ballots), [movies, ballots]);
  const voterCount = ballots.filter(b => b.plus.length || b.minus.length).length;

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-3xl font-bold text-white">Výsledky – {edition.name}</h2>
        <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-2">
          {edition.archived && <><Archive size={14} /> Archiv ·</>} {movies.length} filmů · hlasovalo {voterCount} lidí
        </p>
      </div>

      {results.length === 0 && <p className="text-center text-gray-500">V tomto ročníku nejsou žádné filmy.</p>}

      <div className="grid gap-6">
        {results.map(movie => {
          const winner = movie.rank <= edition.winners;
          const votes = movie.plus + movie.minus || 1;
          return (
            <div key={movie.id} className={`relative overflow-hidden rounded-xl border ${winner ? 'bg-gray-800 border-yellow-500/50 shadow-lg' : 'bg-gray-900 border-gray-700 opacity-80'}`}>
              <div className={`absolute top-0 right-0 font-bold px-3 py-1 rounded-bl-lg text-sm ${winner ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'}`}>#{movie.rank}</div>
              <div className="p-6">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold text-white break-words pr-8">{movie.title}</h3>
                    <p className="text-sm text-gray-400">Nominoval/a: {movie.nominator}</p>
                    {movie.link && <a href={movie.link} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline inline-flex items-center gap-1 mt-1"><LinkIcon size={14} /> Detail filmu</a>}
                  </div>
                  <div className="text-right shrink-0 mt-6"><div className="text-4xl font-bold text-white">{movie.total}</div><div className="text-xs text-gray-500">SKÓRE</div></div>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden bg-gray-700 mb-4">
                  <div style={{ width: `${(movie.plus / votes) * 100}%` }} className="bg-green-500 transition-all duration-1000"></div>
                  <div style={{ width: `${(movie.minus / votes) * 100}%` }} className="bg-red-500 transition-all duration-1000"></div>
                </div>
                <div className="flex justify-between text-sm mb-4 border-b border-gray-700 pb-4">
                  <span className="text-green-400 flex items-center gap-1"><ThumbsUp size={14} /> {movie.plus}</span>
                  <span className="text-red-400 flex items-center gap-1">{movie.minus} <ThumbsDown size={14} /></span>
                </div>
                {movie.voters.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Jak kdo hlasoval:</h4>
                    <div className="flex flex-wrap gap-2">
                      {movie.voters.map((v, i) => (
                        <span key={i} className={`text-xs px-2 py-1 rounded border ${v.type === 1 ? 'bg-green-900/30 border-green-800 text-green-300' : 'bg-red-900/30 border-red-800 text-red-300'}`}>{v.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
