'use client';

import { useMemo, useState } from 'react';
import { Edit2, Film, Link as LinkIcon, Trash2, User as UserIcon, X } from 'lucide-react';
import { addMovie, deleteMovie, updateMovie, type MovieInput } from '@/lib/data';
import { toast, toastError } from '@/lib/toast';
import type { Edition, Movie, Player } from '@/lib/types';
import { ConfirmModal, inputClass } from './ui';

interface Props {
  edition: Edition;
  player: Player;
  movies: Movie[];
  isAdmin: boolean;
}

const EMPTY: MovieInput = { title: '', link: '', comment: '' };
const normalizeTitle = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function NominationPhase({ edition, player, movies, isAdmin }: Props) {
  const [form, setForm] = useState<MovieInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Movie | null>(null);

  const sorted = useMemo(
    () => [...movies].sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity)),
    [movies],
  );

  const duplicate = useMemo(() => {
    const t = normalizeTitle(form.title);
    if (t.length < 2) return null;
    return movies.find(m => m.id !== editingId && normalizeTitle(m.title) === t) ?? null;
  }, [form.title, movies, editingId]);

  const canManage = (m: Movie) => isAdmin || m.nominatorKey === player.key;
  const myCount = movies.filter(m => m.nominatorKey === player.key).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      if (editingId) {
        await updateMovie(edition.id, editingId, form);
        toast('Nominace upravena.', 'success');
      } else {
        await addMovie(edition.id, player, form);
        toast(`„${form.title.trim()}“ nominován.`, 'success');
      }
      setForm(EMPTY);
      setEditingId(null);
    } catch (err) {
      toastError(err, 'Film se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (m: Movie) => {
    setEditingId(m.id);
    setForm({ title: m.title, link: m.link, comment: m.comment });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const movie = toDelete;
    setToDelete(null);
    try {
      await deleteMovie(edition.id, movie.id);
      toast(`„${movie.title}“ odebrán.`, 'success');
    } catch (err) {
      toastError(err, 'Mazání se nepovedlo.');
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmModal
        isOpen={!!toDelete}
        title="Odebrat film?"
        message={`Opravdu chceš smazat nominaci filmu „${toDelete?.title}“?`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
          <Film className="w-5 h-5" /> {editingId ? 'Upravit nominaci' : 'Nominovat film'}
        </h3>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <input required maxLength={200} type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Název filmu *" />
            {duplicate && (
              <p className="text-xs text-yellow-400 mt-1">Pozor, „{duplicate.title}“ už nominoval/a {duplicate.nominator}.</p>
            )}
          </div>
          <input type="text" inputMode="url" maxLength={500} value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className={inputClass} placeholder="Odkaz (ČSFD, IMDb, trailer…)" />
          <input type="text" maxLength={500} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className={inputClass} placeholder="Proč ho vidět?" />
          <div className="md:col-span-2 flex gap-3">
            <button disabled={busy || !form.title.trim()} type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded transition">
              {busy ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Přidat nominaci'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-1">
                <X size={16} /> Zrušit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex justify-between text-sm text-gray-400">
        <span>Nominováno filmů: <b className="text-white">{movies.length}</b></span>
        <span>Z toho tvých: <b className="text-white">{myCount}</b></span>
      </div>

      {sorted.length === 0 && <p className="text-center text-gray-500 py-8">Zatím žádné nominace. Buď první!</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map(movie => (
          <div key={movie.id} className={`bg-gray-800 p-4 rounded-lg border flex flex-col justify-between ${movie.nominatorKey === player.key ? 'border-yellow-700/60' : 'border-gray-700'}`}>
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h4 className="font-bold text-lg text-white break-words min-w-0">{movie.title}</h4>
                {canManage(movie) && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(movie)} aria-label="Upravit" className="text-gray-400 hover:text-yellow-500 p-2 bg-gray-900 rounded-md border border-gray-700 hover:border-yellow-500 transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => setToDelete(movie)} aria-label="Smazat" className="text-gray-400 hover:text-red-500 p-2 bg-gray-900 rounded-md border border-gray-700 hover:border-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1"><UserIcon size={12} /> Nominoval/a: <span className="text-yellow-500">{movie.nominator}</span></div>
              {movie.comment && <p className="text-sm text-gray-300 italic mb-3 break-words">„{movie.comment}“</p>}
            </div>
            {movie.link && <a href={movie.link} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 mt-2"><LinkIcon size={14} /> Detail filmu</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
