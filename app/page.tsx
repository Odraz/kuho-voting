'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, onSnapshot,
  doc, setDoc, deleteDoc, query, orderBy, serverTimestamp,
  where, writeBatch, getDocs, Timestamp
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser
} from 'firebase/auth';
import {
  ThumbsUp, ThumbsDown, Film, User as UserIcon, Link as LinkIcon,
  Trophy, Lock, Trash2, Edit2, X, KeyRound, AlertTriangle, LogOut, LogIn
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

const COLL_MOVIES = 'movies';
const COLL_VOTES = 'votes';
const COLL_CONFIG = 'config';
const DOC_STATE = 'app_state';

// --- TYPES & INTERFACES ---

interface Movie {
  id: string;
  title: string;
  link?: string;
  comment?: string;
  nominator: string;
  nominatorId: string;
  createdAt: Timestamp;
}

interface VoteDoc {
  votes: Record<string, number>;
  userName: string;
  updatedAt: Timestamp;
}

interface ScoredMovie extends Movie {
  plus: number;
  minus: number;
  total: number;
  voters: { name: string; type: number }[];
}

// --- COMPONENTS ---

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-800 p-6 rounded-xl max-w-sm w-full border border-gray-600 shadow-2xl">
        <div className="flex items-center gap-3 text-yellow-500 mb-4">
          <AlertTriangle size={24} />
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">Zrušit</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold transition-colors">Ano, smazat</button>
        </div>
      </div>
    </div>
  );
};

interface UserIdentityProps {
  user: FirebaseUser | null;
  onNameSet: (name: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isUpdating?: boolean;
}

const UserIdentity = ({ user, onNameSet, isOpen, onClose }: UserIdentityProps) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onNameSet(name);
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (error: any) {
      console.error("Google login error", error);
      if (error?.code === 'auth/unauthorized-domain') {
        alert(`Doména "${window.location.hostname}" není povolena v Firebase Console.\n\nJděte do Authentication -> Settings -> Authorized domains a přidejte ji.`);
      } else if (error?.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no error needed
      } else {
        alert("Chyba při přihlášení Googlem: " + (error?.message || 'Neznámá chyba'));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>

        <div className="text-center mb-6">
          <Film className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-white">KUHO</h2>
          <p className="text-gray-400">Nastavení identity</p>
        </div>

        <div className="space-y-6">
          {!user?.isAnonymous && user?.email ? (
            <div className="bg-green-900/30 p-3 rounded text-center border border-green-800">
              <p className="text-xs text-green-400 mb-1">Přihlášen jako:</p>
              <p className="font-bold text-white">{user.email}</p>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-black font-bold py-3 rounded flex items-center justify-center gap-2 hover:bg-gray-200 transition"
            >
              <LogIn size={18} /> Přihlásit se přes Google
            </button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-800 px-2 text-gray-500">Nebo jen přezdívka</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tvoje přezdívka"
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white focus:border-yellow-500 outline-none"
            />
            <button type="submit" disabled={!name?.trim()} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded transition">
              Uložit jméno
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

interface NominationPhaseProps {
  user: FirebaseUser | null;
  movies: Movie[];
}

const NominationPhase = ({ user, movies }: NominationPhaseProps) => {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; movieId: string | null; movieTitle: string }>({
    isOpen: false, movieId: null, movieTitle: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, COLL_MOVIES), {
        title, link, comment,
        nominator: user.displayName || 'Anonym',
        nominatorId: user.uid,
        createdAt: serverTimestamp()
      });
      setTitle(''); setLink(''); setComment('');
    } catch (error) {
      console.error("Error adding movie:", error);
      alert("Nepodařilo se přidat film. Jste připojeni?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const { movieId } = deleteModal;
    if (!movieId) return;
    try {
      await deleteDoc(doc(db, COLL_MOVIES, movieId));
      setDeleteModal({ isOpen: false, movieId: null, movieTitle: '' });
    } catch (e) {
      alert("Chyba při mazání.");
    }
  };

  const canDelete = (movie: Movie) => {
    if (!user) return false;
    if (user.email === 'tomas.pouzar@gmail.com') return true;
    return movie.nominatorId === user.uid;
  };

  return (
    <div className="space-y-8">
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Odebrat film?"
        message={`Opravdu chceš smazat nominaci filmu "${deleteModal.movieTitle}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ isOpen: false, movieId: null, movieTitle: '' })}
      />

      <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
          <Film className="w-5 h-5" /> Nominovat film
        </h3>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-yellow-500 outline-none" placeholder="Název filmu *" />
          </div>
          <div><input type="url" value={link} onChange={(e) => setLink(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-yellow-500 outline-none" placeholder="Odkaz..." /></div>
          <div><input type="text" value={comment} onChange={(e) => setComment(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-yellow-500 outline-none" placeholder="Komentář..." /></div>
          <div className="md:col-span-2">
            <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition">Přidat nominaci</button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {movies.map(movie => (
          <div key={movie.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between group relative">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-lg text-white mr-8">{movie.title}</h4>
                {canDelete(movie) && (
                  <button onClick={() => setDeleteModal({ isOpen: true, movieId: movie.id, movieTitle: movie.title })} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-900 rounded-md border border-gray-700 hover:border-red-500">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1"><UserIcon size={12} /> Nominoval: <span className="text-yellow-500">{movie.nominator}</span></div>
              {movie.comment && <p className="text-sm text-gray-300 italic mb-3">"{movie.comment}"</p>}
            </div>
            {movie.link && <a href={movie.link} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 mt-2"><LinkIcon size={14} /> Detail filmu</a>}
          </div>
        ))}
      </div>
    </div>
  );
};

interface VotingPhaseProps {
  user: FirebaseUser | null;
  movies: Movie[];
  userVotes: Record<string, number>;
  remainingPlus: number;
  remainingMinus: number;
}

const VotingPhase = ({ user, movies, userVotes, remainingPlus, remainingMinus }: VotingPhaseProps) => {
  const handleVote = async (movieId: string, type: 'plus' | 'minus') => {
    if (!user) return;
    const currentVote = userVotes[movieId] || 0;
    let newVote = 0;

    if (type === 'plus') {
      if (currentVote === 1) newVote = 0;
      else if (remainingPlus > 0 || currentVote === -1) newVote = 1;
      else return;
    } else if (type === 'minus') {
      if (currentVote === -1) newVote = 0;
      else if (remainingMinus > 0 || currentVote === 1) newVote = -1;
      else return;
    }

    const newVotesMap = { ...userVotes, [movieId]: newVote };
    Object.keys(newVotesMap).forEach(key => { if (newVotesMap[key] === 0) delete newVotesMap[key]; });

    try {
      await setDoc(doc(db, COLL_VOTES, user.uid), {
        votes: newVotesMap,
        userName: user.displayName,
        updatedAt: serverTimestamp()
      });
    } catch (err) { console.error("Voting failed", err); }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-700 p-4 -mx-4 md:mx-0 md:rounded-xl shadow-xl flex justify-between items-center flex-wrap gap-4">
        <div><h3 className="text-white font-bold">Hlasování (D21)</h3><p className="text-xs text-gray-400">Max 7 kladných, 1 záporný</p></div>
        <div className="flex gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${remainingPlus > 0 ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-800 border-gray-600 text-gray-500'}`}><ThumbsUp size={18} /><span className="font-mono font-bold">{remainingPlus}</span></div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${remainingMinus > 0 ? 'bg-red-900/30 border-red-600 text-red-400' : 'bg-gray-800 border-gray-600 text-gray-500'}`}><ThumbsDown size={18} /><span className="font-mono font-bold">{remainingMinus}</span></div>
        </div>
      </div>
      <div className="grid gap-3">
        {movies.map(movie => {
          const myVote = userVotes[movie.id] || 0;
          return (
            <div key={movie.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-center justify-between transition-all ${myVote === 1 ? 'bg-green-900/20 border-green-600/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : myVote === -1 ? 'bg-red-900/20 border-red-600/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-bold text-white text-lg">{movie.title}</h4>
                <div className="text-sm text-gray-400">Nominoval: {movie.nominator}</div>
                {movie.comment && <p className="text-xs text-gray-500 mt-1 italic">"{movie.comment}"</p>}
                {movie.link && <a href={movie.link} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 mt-1"><LinkIcon size={14} /> Detail filmu</a>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleVote(movie.id, 'minus')} disabled={myVote !== -1 && remainingMinus === 0} className={`p-3 rounded-full transition ${myVote === -1 ? 'bg-red-600 text-white shadow-lg scale-110' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'} disabled:opacity-30`}><ThumbsDown size={24} /></button>
                <button onClick={() => handleVote(movie.id, 'plus')} disabled={myVote !== 1 && remainingPlus === 0} className={`p-3 rounded-full transition ${myVote === 1 ? 'bg-green-600 text-white shadow-lg scale-110' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'} disabled:opacity-30`}><ThumbsUp size={24} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ResultsPhaseProps {
  movies: Movie[];
  allVotes: VoteDoc[];
}

const ResultsPhase = ({ movies, allVotes }: ResultsPhaseProps) => {
  const results = useMemo(() => {
    const scores: ScoredMovie[] = movies.map(m => ({ ...m, plus: 0, minus: 0, total: 0, voters: [] }));
    allVotes.forEach(voteDoc => {
      if (!voteDoc.votes) return;
      Object.entries(voteDoc.votes).forEach(([movieId, value]) => {
        const m = scores.find(s => s.id === movieId);
        if (m) {
          if (value === 1) m.plus++; else m.minus++;
          m.total += value;
          m.voters.push({ name: voteDoc.userName, type: value });
        }
      });
    });
    return scores.sort((a, b) => b.total - a.total);
  }, [movies, allVotes]);

  return (
    <div className="space-y-8">
      <div className="text-center py-6"><Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-2" /><h2 className="text-3xl font-bold text-white">Vítězové</h2></div>
      <div className="grid gap-6">
        {results.map((movie, index) => (
          <div key={movie.id} className={`relative overflow-hidden rounded-xl border ${index < 4 ? 'bg-gray-800 border-yellow-500/50 shadow-lg' : 'bg-gray-900 border-gray-700 opacity-80'}`}>
            {index < 4 && <div className="absolute top-0 right-0 bg-yellow-500 text-black font-bold px-3 py-1 rounded-bl-lg text-sm">#{index + 1}</div>}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-2xl font-bold text-white">{movie.title}</h3><p className="text-sm text-gray-400">Nominoval: {movie.nominator}</p></div>
                <div className="text-right"><div className="text-4xl font-bold text-white">{movie.total}</div><div className="text-xs text-gray-500">SKÓRE</div></div>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-700 mb-4">
                <div style={{ width: `${(movie.plus / (movie.plus + movie.minus || 1)) * 100}%` }} className="bg-green-500 transition-all duration-1000"></div>
                <div style={{ width: `${(movie.minus / (movie.plus + movie.minus || 1)) * 100}%` }} className="bg-red-500 transition-all duration-1000"></div>
              </div>
              <div className="flex justify-between text-sm mb-4 border-b border-gray-700 pb-4">
                <span className="text-green-400 flex items-center gap-1"><ThumbsUp size={14} /> {movie.plus} hlasů</span>
                <span className="text-red-400 flex items-center gap-1">{movie.minus} hlasů <ThumbsDown size={14} /></span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Jak kdo hlasoval:</h4>
                <div className="flex flex-wrap gap-2">
                  {movie.voters.map((v, i) => (<span key={i} className={`text-xs px-2 py-1 rounded border ${v.type === 1 ? 'bg-green-900/30 border-green-800 text-green-300' : 'bg-red-900/30 border-red-800 text-red-300'}`}>{v.name}</span>))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AdminPanelProps {
  currentPhase: string;
  onSetPhase: (phase: string) => void;
  movies: Movie[];
  user: FirebaseUser | null;
}

const AdminPanel = ({ currentPhase, onSetPhase, movies, user }: AdminPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Strict check: Only this specific email sees the panel
  const isEmailAdmin = user?.email === 'tomas.pouzar@gmail.com';

  if (!isEmailAdmin) {
    return null;
  }

  const handleImport = async () => {
    if (!user) return;
    const lines = csvText.split('\n');
    let added = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 1) {
        try {
          await addDoc(collection(db, COLL_MOVIES), {
            title: parts[0]?.trim() || "Neznámý film",
            link: parts[1]?.trim() || "",
            nominator: parts[2]?.trim() || "Admin Import",
            comment: parts[3]?.trim() || "",
            createdAt: serverTimestamp(),
            nominatorId: user.uid
          });
          added++;
        } catch (e) { console.error(e); }
      }
    }
    alert(`Importováno ${added} filmů.`);
    setCsvText('');
  };

  return (
    <div className="mt-12 border-t border-gray-800 pt-8">
      <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600 text-xs flex items-center gap-1 hover:text-gray-400">
        <Lock size={12} /> Administrace (Tomas Pouzar)
      </button>
      {isOpen && (
        <div className="mt-4 bg-gray-900 p-4 rounded border border-gray-700 space-y-4">
          <div>
            <h4 className="text-white font-bold mb-2">Fáze akce</h4>
            <div className="flex gap-2">
              {['nomination', 'voting', 'results'].map(phase => (
                <button key={phase} onClick={() => onSetPhase(phase)} className={`px-3 py-1 text-sm rounded ${currentPhase === phase ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'}`}>{phase.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-2">Import filmů</h4>
            <textarea className="w-full h-24 bg-black text-xs text-gray-300 p-2 border border-gray-700 rounded font-mono" placeholder={`Matrix\thttps://csfd...\tPepa\tMusíme vidět!`} value={csvText} onChange={e => setCsvText(e.target.value)} />
            <button onClick={handleImport} className="mt-2 bg-blue-900 text-blue-200 text-xs px-3 py-1 rounded border border-blue-700 hover:bg-blue-800">Importovat dávku</button>
          </div>
          <div className="text-xs text-gray-500">Celkem filmů v DB: {movies.length}</div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [phase, setPhase] = useState('nomination');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [allVotes, setAllVotes] = useState<VoteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        signInAnonymously(auth).catch(e => console.error("Anon auth fail", e));
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubConfig = onSnapshot(doc(db, COLL_CONFIG, DOC_STATE), (snap) => {
      if (snap.exists()) setPhase(snap.data().currentPhase || 'nomination');
      else setDoc(doc(db, COLL_CONFIG, DOC_STATE), { currentPhase: 'nomination' });
    });

    const unsubMovies = onSnapshot(query(collection(db, COLL_MOVIES), orderBy('createdAt', 'desc')), (snap) => {
      setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
    });

    const unsubVotes = onSnapshot(collection(db, COLL_VOTES), (snap) => {
      setAllVotes(snap.docs.map(d => d.data() as VoteDoc));
      const myVoteDoc = snap.docs.find(d => d.id === user.uid);
      setMyVotes(myVoteDoc ? (myVoteDoc.data().votes || {}) : {});
    });

    return () => { unsubConfig(); unsubMovies(); unsubVotes(); };
  }, [user]);

  const handleUpdateName = async (name: string) => {
    if (user) {
      setIsUpdatingName(true);
      try {
        await updateProfile(user, { displayName: name });
        setUser((prev) => prev ? ({ ...prev, displayName: name }) as FirebaseUser : null);

        const batch = writeBatch(db);
        const qById = query(collection(db, COLL_MOVIES), where("nominatorId", "==", user.uid));
        const snapById = await getDocs(qById);
        snapById.forEach(d => batch.update(d.ref, { nominator: name }));

        batch.set(doc(db, COLL_VOTES, user.uid), { userName: name }, { merge: true });

        await batch.commit();
        setIsEditingName(false);
      } catch (e) {
        alert("Chyba při ukládání jména.");
      } finally {
        setIsUpdatingName(false);
      }
    }
  };

  const handleSetPhase = async (newPhase: string) => {
    await setDoc(doc(db, COLL_CONFIG, DOC_STATE), { currentPhase: newPhase }, { merge: true });
  };

  const plusUsed = Object.values(myVotes).filter(v => v === 1).length;
  const minusUsed = Object.values(myVotes).filter(v => v === -1).length;

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Načítám...</div>;

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-yellow-500 selection:text-black pb-20">

      <UserIdentity
        user={user}
        onNameSet={handleUpdateName}
        isOpen={isEditingName || (!user?.displayName && !loading)}
        isUpdating={isUpdatingName}
        onClose={() => setIsEditingName(false)}
      />

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
              <span className="text-yellow-500">KUHO</span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className={`w-2 h-2 rounded-full ${phase === 'nomination' ? 'bg-blue-500' : phase === 'voting' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              Aktuální stav: <span className="text-white uppercase font-bold tracking-wide">
                {phase === 'nomination' ? 'Nominace filmů' : phase === 'voting' ? 'Hlasování' : 'Vyhlášení výsledků'}
              </span>
            </div>
          </div>
          <div className="text-right hidden sm:block group">
            <div className="text-xs text-gray-500">Přihlášen jako</div>
            <div
              className="font-bold text-yellow-500 flex items-center gap-2 cursor-pointer hover:text-white transition-colors justify-end"
              onClick={() => setIsEditingName(true)}
              title="Změnit přezdívku"
            >
              {user?.displayName || 'Anonym'}
              <Edit2 size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
            {!user?.isAnonymous && (
              <button onClick={() => signOut(auth)} className="text-xs text-red-400 hover:underline mt-1 flex items-center justify-end gap-1 w-full">
                <LogOut size={10} /> Odhlásit se
              </button>
            )}
          </div>
        </header>

        <main>
          {phase === 'nomination' && <NominationPhase user={user} movies={movies} />}
          {phase === 'voting' && <VotingPhase user={user} movies={movies} userVotes={myVotes} remainingPlus={7 - plusUsed} remainingMinus={1 - minusUsed} />}
          {phase === 'results' && <ResultsPhase movies={movies} allVotes={allVotes} />}
        </main>

        <AdminPanel user={user} currentPhase={phase} onSetPhase={handleSetPhase} movies={movies} />
      </div>
    </div>
  );
}