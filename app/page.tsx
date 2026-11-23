'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { Archive, LogOut, RefreshCw } from 'lucide-react';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { checkIsAdmin, paths, toBallot, toEdition, toMovie } from '@/lib/data';
import { loadPlayer, savePlayer } from '@/lib/nickname';
import { describeError } from '@/lib/toast';
import { PHASE_LABELS, type Ballot, type Edition, type Movie, type Player } from '@/lib/types';
import { LoginScreen } from '@/components/LoginScreen';
import { NominationPhase } from '@/components/NominationPhase';
import { VotingPhase } from '@/components/VotingPhase';
import { ResultsPhase } from '@/components/ResultsPhase';
import { AdminPanel } from '@/components/AdminPanel';
import { FullScreenMessage, Spinner, Toaster } from '@/components/ui';

const PHASE_DOT = { nomination: 'bg-blue-500', voting: 'bg-green-500', results: 'bg-yellow-500' };

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(() => (typeof window === 'undefined' ? null : loadPlayer()));
  const [isAdmin, setIsAdmin] = useState(false);

  const [configLoaded, setConfigLoaded] = useState(false);
  const [currentEditionId, setCurrentEditionId] = useState<string | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  // --- Auth: every visitor gets an anonymous Firebase session (needed by security rules).
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, u => {
      if (u) {
        setAuthUser(u);
        checkIsAdmin(u.uid).then(setIsAdmin);
      } else {
        setAuthUser(null);
        signInAnonymously(auth).catch(err => setFatalError(describeError(err, 'Nepodařilo se připojit.')));
      }
    });
  }, []);

  // --- Global data: config + list of editions.
  useEffect(() => {
    if (!authUser) return;
    const onError = (err: unknown) => setDataError(describeError(err, 'Nepodařilo se načíst data.'));
    const unsubConfig = onSnapshot(paths.config(), snap => {
      setCurrentEditionId((snap.data()?.currentEdition as string | undefined) ?? null);
      setConfigLoaded(true);
      setDataError(null);
    }, onError);
    const unsubEditions = onSnapshot(paths.editions(), snap => {
      setEditions(snap.docs.map(d => toEdition(d.id, d.data())).sort((a, b) => b.year - a.year));
    }, onError);
    return () => { unsubConfig(); unsubEditions(); };
  }, [authUser]);

  const viewedId = selectedId ?? currentEditionId;
  const edition = useMemo(() => editions.find(e => e.id === viewedId) ?? null, [editions, viewedId]);

  // --- Data of the edition being viewed.
  useEffect(() => {
    if (!authUser || !viewedId) return;
    const onError = (err: unknown) => setDataError(describeError(err, 'Nepodařilo se načíst data.'));
    const unsubMovies = onSnapshot(paths.movies(viewedId), snap => {
      setMovies(snap.docs.map(d => toMovie(d.id, d.data({ serverTimestamps: 'estimate' }))));
    }, onError);
    const unsubVotes = onSnapshot(paths.votes(viewedId), snap => {
      setBallots(snap.docs.map(d => toBallot(d.id, d.data())));
    }, onError);
    return () => { unsubMovies(); unsubVotes(); setMovies([]); setBallots([]); };
  }, [authUser, viewedId]);

  const login = (p: Player) => { savePlayer(p); setPlayer(p); };
  const logout = () => { savePlayer(null); setPlayer(null); };

  const blockingError = isFirebaseConfigured()
    ? fatalError
    : 'Chybí konfigurace Firebase (proměnné NEXT_PUBLIC_FIREBASE_*).';

  if (blockingError) {
    return (
      <FullScreenMessage>
        <p className="text-red-400">{blockingError}</p>
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded"><RefreshCw size={16} /> Zkusit znovu</button>
      </FullScreenMessage>
    );
  }

  if (!authUser) return <FullScreenMessage><Spinner label="Připojuji…" /></FullScreenMessage>;

  if (!player) return <><LoginScreen onLogin={login} /><Toaster /></>;

  const isCurrent = edition?.id === currentEditionId;
  const readOnly = !edition || edition.archived || !isCurrent;
  const phase = edition ? (readOnly ? 'results' : edition.phase) : null;

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-yellow-500 selection:text-black pb-20">
      <Toaster />
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="flex justify-between items-end gap-4 mb-8 border-b border-gray-800 pb-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
              <span className="text-yellow-500">KUHO</span>{edition && <span className="text-gray-500 text-2xl ml-2">{edition.year || edition.name}</span>}
            </h1>
            {edition && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {readOnly ? (
                  <><Archive size={14} /> <span className="text-white uppercase font-bold tracking-wide">{edition.archived ? 'Archiv' : 'Jiný ročník'}</span></>
                ) : (
                  <><span className={`w-2 h-2 rounded-full ${PHASE_DOT[edition.phase]}`}></span>
                    Aktuální stav: <span className="text-white uppercase font-bold tracking-wide">{PHASE_LABELS[edition.phase]}</span></>
                )}
              </div>
            )}
          </div>
          <div className="flex items-end gap-4">
            {editions.length > 1 && (
              <label className="text-xs text-gray-500">
                Ročník
                <select value={viewedId ?? ''} onChange={e => setSelectedId(e.target.value === currentEditionId ? null : e.target.value)} className="block mt-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white">
                  {editions.map(e => (
                    <option key={e.id} value={e.id}>{e.name}{e.id === currentEditionId ? ' (aktuální)' : e.archived ? ' (archiv)' : ''}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="text-right">
              <div className="text-xs text-gray-500">Přihlášen/a jako</div>
              <div className="font-bold text-yellow-500">{player.name}</div>
              <button onClick={logout} className="text-xs text-gray-500 hover:text-white mt-1 inline-flex items-center gap-1 transition-colors">
                <LogOut size={10} /> Odhlásit
              </button>
            </div>
          </div>
        </header>

        {dataError && (
          <div className="mb-6 p-3 rounded border border-red-800 bg-red-950/40 text-red-300 text-sm flex justify-between items-center gap-4">
            <span>{dataError}</span>
            <button onClick={() => window.location.reload()} className="shrink-0 inline-flex items-center gap-1 underline"><RefreshCw size={14} /> Načíst znovu</button>
          </div>
        )}

        <main>
          {!configLoaded && !dataError && <Spinner />}
          {configLoaded && !edition && (
            <p className="text-center text-gray-400 py-16">Letošní ročník ještě nebyl založen. Vydrž, admin to brzy spustí. 🎬</p>
          )}
          {edition && phase === 'nomination' && <NominationPhase edition={edition} player={player} movies={movies} isAdmin={isAdmin} />}
          {edition && phase === 'voting' && <VotingPhase edition={edition} player={player} movies={movies} ballots={ballots} />}
          {edition && phase === 'results' && <ResultsPhase edition={edition} movies={movies} ballots={ballots} />}
        </main>

        <AdminPanel
          uid={authUser.uid}
          isAdmin={isAdmin}
          onAdminChange={setIsAdmin}
          editions={editions}
          currentEditionId={currentEditionId}
          edition={edition}
          movies={movies}
          ballots={ballots}
        />
      </div>
    </div>
  );
}
