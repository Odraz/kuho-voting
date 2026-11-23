'use client';

import { useMemo } from 'react';
import { Link as LinkIcon, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { saveBallot } from '@/lib/data';
import { toast, toastError } from '@/lib/toast';
import type { Ballot, Edition, Movie, Player } from '@/lib/types';

interface Props {
  edition: Edition;
  player: Player;
  movies: Movie[];
  ballots: Ballot[];
}

export function VotingPhase({ edition, player, movies, ballots }: Props) {
  const sorted = useMemo(() => [...movies].sort((a, b) => a.title.localeCompare(b.title, 'cs')), [movies]);

  // Only count votes for movies that still exist (a nomination may have been removed).
  const { plus, minus } = useMemo(() => {
    const ids = new Set(movies.map(m => m.id));
    const mine = ballots.find(b => b.key === player.key);
    return {
      plus: (mine?.plus ?? []).filter(id => ids.has(id)),
      minus: (mine?.minus ?? []).filter(id => ids.has(id)),
    };
  }, [ballots, movies, player.key]);

  const remainingPlus = edition.plusVotes - plus.length;
  const remainingMinus = edition.minusVotes - minus.length;
  const voters = ballots.filter(b => b.plus.length || b.minus.length);

  const handleVote = (movieId: string, type: 'plus' | 'minus') => {
    let nextPlus = plus.filter(id => id !== movieId);
    let nextMinus = minus.filter(id => id !== movieId);
    const current = plus.includes(movieId) ? 'plus' : minus.includes(movieId) ? 'minus' : null;

    if (current !== type) {
      if (type === 'plus') {
        if (nextPlus.length >= edition.plusVotes) { toast('Už jsi rozdal/a všechny kladné hlasy. Nejdřív nějaký odeber.'); return; }
        nextPlus = [...nextPlus, movieId];
      } else {
        if (nextMinus.length >= edition.minusVotes) { toast('Už jsi rozdal/a všechny záporné hlasy. Nejdřív nějaký odeber.'); return; }
        nextMinus = [...nextMinus, movieId];
      }
    }

    // Not awaited on purpose: Firestore updates the UI instantly (and works offline),
    // the promise only settles once the server confirms.
    saveBallot(edition.id, player, nextPlus, nextMinus).catch(err => toastError(err, 'Hlas se nepodařilo uložit.'));
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-700 p-4 -mx-4 md:mx-0 md:rounded-xl shadow-xl flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-white font-bold">Hlasování</h3>
          <p className="text-xs text-gray-400">Max {edition.plusVotes} kladných, {edition.minusVotes} záporný. Hlasy můžeš měnit až do konce hlasování.</p>
        </div>
        <div className="flex gap-4">
          <div title="Zbývající kladné hlasy" className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${remainingPlus > 0 ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-800 border-gray-600 text-gray-500'}`}><ThumbsUp size={18} /><span className="font-mono font-bold">{remainingPlus}</span></div>
          <div title="Zbývající záporné hlasy" className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${remainingMinus > 0 ? 'bg-red-900/30 border-red-600 text-red-400' : 'bg-gray-800 border-gray-600 text-gray-500'}`}><ThumbsDown size={18} /><span className="font-mono font-bold">{remainingMinus}</span></div>
        </div>
      </div>

      <div className="text-xs text-gray-500 flex items-start gap-2">
        <Users size={14} className="shrink-0 mt-0.5" />
        <span>Hlasovali ({voters.length}): {voters.length ? voters.map(v => v.name).join(', ') : 'zatím nikdo'}</span>
      </div>

      {sorted.length === 0 && <p className="text-center text-gray-500 py-8">Nejsou nominované žádné filmy.</p>}

      <div className="grid gap-3">
        {sorted.map(movie => {
          const myVote = plus.includes(movie.id) ? 1 : minus.includes(movie.id) ? -1 : 0;
          return (
            <div key={movie.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-center justify-between transition-all ${myVote === 1 ? 'bg-green-900/20 border-green-600/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : myVote === -1 ? 'bg-red-900/20 border-red-600/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex-1 text-center sm:text-left min-w-0">
                <h4 className="font-bold text-white text-lg break-words">{movie.title}</h4>
                <div className="text-sm text-gray-400">Nominoval/a: {movie.nominator}</div>
                {movie.comment && <p className="text-xs text-gray-500 mt-1 italic break-words">„{movie.comment}“</p>}
                {movie.link && <a href={movie.link} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline inline-flex items-center gap-1 mt-1"><LinkIcon size={14} /> Detail filmu</a>}
              </div>
              <div className="flex items-center gap-3">
                <button aria-label="Záporný hlas" aria-pressed={myVote === -1} onClick={() => handleVote(movie.id, 'minus')} disabled={myVote !== -1 && remainingMinus <= 0} className={`p-3 rounded-full transition ${myVote === -1 ? 'bg-red-600 text-white shadow-lg scale-110' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'} disabled:opacity-30`}><ThumbsDown size={24} /></button>
                <button aria-label="Kladný hlas" aria-pressed={myVote === 1} onClick={() => handleVote(movie.id, 'plus')} disabled={myVote !== 1 && remainingPlus <= 0} className={`p-3 rounded-full transition ${myVote === 1 ? 'bg-green-600 text-white shadow-lg scale-110' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'} disabled:opacity-30`}><ThumbsUp size={24} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
