'use client';

import { useEffect, useState } from 'react';
import { deleteDoc } from 'firebase/firestore';
import { Archive, KeyRound, Lock, LogOut, Trash2 } from 'lucide-react';
import {
  becomeAdmin, createEdition, importMovies, leaveAdmin, legacyDataExists,
  migrateLegacy, paths, setCurrentEdition, updateEdition,
} from '@/lib/data';
import { toast, toastError } from '@/lib/toast';
import { PHASE_LABELS, PHASES, type Ballot, type Edition, type Movie } from '@/lib/types';
import { ConfirmModal, inputClass } from './ui';

interface Props {
  uid: string;
  isAdmin: boolean;
  onAdminChange: (isAdmin: boolean) => void;
  editions: Edition[];
  currentEditionId: string | null;
  edition: Edition | null;
  movies: Movie[];
  ballots: Ballot[];
}

const LEGACY_YEAR = 2025;

export function AdminPanel(props: Props) {
  const { uid, isAdmin, onAdminChange } = props;
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await becomeAdmin(uid, pin.trim());
      onAdminChange(true);
      setPin('');
      toast('Jsi administrátor.', 'success');
    } catch (err) {
      console.error(err);
      toast('Špatný PIN (nebo ještě není nastavený ve Firebase).', 'error');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await leaveAdmin(uid);
      onAdminChange(false);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="mt-12 border-t border-gray-800 pt-6">
      <button onClick={() => setOpen(!open)} className="text-gray-600 text-xs flex items-center gap-1 hover:text-gray-400">
        <Lock size={12} /> Administrace
      </button>
      {open && !isAdmin && (
        <form onSubmit={login} className="mt-4 flex gap-2 max-w-sm">
          <input type="password" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Admin PIN" className={inputClass} />
          <button disabled={!pin.trim() || busy} className="px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded flex items-center gap-1"><KeyRound size={14} /> Vstoupit</button>
        </form>
      )}
      {open && isAdmin && <AdminTools {...props} onLogout={logout} />}
    </div>
  );
}

function AdminTools({ editions, currentEditionId, edition, movies, ballots, onLogout }: Props & { onLogout: () => void }) {
  const nextYear = Math.max(new Date().getFullYear(), ...editions.map(e => e.year + 1));
  const [newYear, setNewYear] = useState(String(nextYear));
  const [csvText, setCsvText] = useState('');
  const [legacy, setLegacy] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; action: () => Promise<void> } | null>(null);

  const hasLegacyEdition = editions.some(e => e.id === String(LEGACY_YEAR));
  useEffect(() => {
    if (hasLegacyEdition) return;
    legacyDataExists().then(setLegacy).catch(() => setLegacy(false));
  }, [hasLegacyEdition]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast(success, 'success');
    } catch (err) {
      toastError(err);
    }
  };

  const voters = ballots.filter(b => b.plus.length || b.minus.length);

  return (
    <div className="mt-4 bg-gray-900 p-4 rounded border border-gray-700 space-y-6 text-sm">
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        onConfirm={() => { const c = confirm; setConfirm(null); c?.action(); }}
        onCancel={() => setConfirm(null)}
      />

      {legacy && !hasLegacyEdition && (
        <section className="p-3 rounded border border-yellow-700 bg-yellow-950/30 space-y-2">
          <h4 className="text-white font-bold flex items-center gap-2"><Archive size={14} /> Stará data z roku {LEGACY_YEAR}</h4>
          <p className="text-gray-400">V databázi jsou nominace a hlasy z minulého ročníku ve starém formátu. Převeď je do archivu – původní data zůstanou zachována jako záloha.</p>
          <button onClick={() => run(async () => {
            const r = await migrateLegacy(LEGACY_YEAR);
            toast(`Archivováno ${r.movies} filmů a ${r.ballots} hlasovacích lístků.`, 'info');
          }, `Ročník ${LEGACY_YEAR} archivován.`)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-1.5 rounded">
            Archivovat ročník {LEGACY_YEAR}
          </button>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-white font-bold">Aktuální ročník (co vidí všichni)</h4>
        <div className="flex flex-wrap gap-2">
          {editions.map(e => (
            <button key={e.id} onClick={() => run(() => setCurrentEdition(e.id), `Aktuální ročník: ${e.name}`)} className={`px-3 py-1 rounded ${currentEditionId === e.id ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {e.name}{e.archived ? ' (archiv)' : ''}
            </button>
          ))}
        </div>
        <form className="flex gap-2 items-center pt-2" onSubmit={e => {
          e.preventDefault();
          const year = Number(newYear);
          if (!Number.isInteger(year) || year < 2000 || year > 2100) { toast('Zadej rok, např. 2026.', 'error'); return; }
          run(() => createEdition(year, `KUHO ${year}`, true), `Ročník ${year} založen a nastaven jako aktuální.`);
        }}>
          <input type="number" value={newYear} onChange={e => setNewYear(e.target.value)} className={`${inputClass} w-28`} />
          <button className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded">Založit nový ročník</button>
        </form>
      </section>

      {edition && (
        <section className="space-y-3">
          <h4 className="text-white font-bold">Správa ročníku: <span className="text-yellow-500">{edition.name}</span> <span className="text-gray-500 font-normal">(ten, který máš právě otevřený)</span></h4>

          <div>
            <p className="text-gray-400 mb-1">Fáze</p>
            <div className="flex flex-wrap gap-2">
              {PHASES.map(phase => (
                <button key={phase} onClick={() => run(() => updateEdition(edition.id, { phase }), `Fáze: ${PHASE_LABELS[phase]}`)} className={`px-3 py-1 rounded ${edition.phase === phase ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                  {PHASE_LABELS[phase]}
                </button>
              ))}
            </div>
          </div>

          <LimitsForm key={`${edition.id}-${edition.plusVotes}-${edition.minusVotes}-${edition.winners}`} edition={edition} onSave={limits => run(() => updateEdition(edition.id, limits), 'Nastavení uloženo.')} />

          <div>
            {edition.archived ? (
              <button onClick={() => run(() => updateEdition(edition.id, { archived: false }), 'Ročník znovu otevřen.')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded">Zrušit archivaci</button>
            ) : (
              <button onClick={() => setConfirm({
                title: 'Archivovat ročník?',
                message: `${edition.name} se uzavře – zobrazí se výsledky a nikdo už nebude moci nominovat ani hlasovat.`,
                label: 'Archivovat',
                action: () => run(() => updateEdition(edition.id, { archived: true, phase: 'results' }), 'Ročník archivován.'),
              })} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded flex items-center gap-1"><Archive size={14} /> Archivovat ročník</button>
            )}
          </div>

          <div>
            <p className="text-gray-400 mb-1">Hlasovali ({voters.length})</p>
            <div className="flex flex-wrap gap-2">
              {voters.map(b => (
                <span key={b.key} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 flex items-center gap-2">
                  {b.name} <span className="text-gray-500">+{b.plus.length}/−{b.minus.length}</span>
                  <button title="Smazat hlasy" onClick={() => setConfirm({
                    title: 'Smazat hlasy?',
                    message: `Opravdu smazat všechny hlasy hráče ${b.name} v ročníku ${edition.name}?`,
                    label: 'Smazat',
                    action: () => run(() => deleteDoc(paths.ballot(edition.id, b.key)), 'Hlasy smazány.'),
                  })} className="text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-gray-400 mb-1">Hromadný import filmů (řádek = název ⇥ odkaz ⇥ nominující ⇥ komentář, např. zkopírováno z Excelu)</p>
            <textarea className="w-full h-24 bg-black text-xs text-gray-300 p-2 border border-gray-700 rounded font-mono" placeholder={'Matrix\thttps://www.csfd.cz/...\tPepa\tMusíme vidět!'} value={csvText} onChange={e => setCsvText(e.target.value)} />
            <button disabled={!csvText.trim()} onClick={() => run(async () => {
              const n = await importMovies(edition.id, csvText);
              setCsvText('');
              toast(`Importováno ${n} filmů.`, 'info');
            }, 'Import hotov.')} className="mt-1 bg-blue-900 text-blue-200 px-3 py-1 rounded border border-blue-700 hover:bg-blue-800 disabled:opacity-50">Importovat</button>
            <p className="text-xs text-gray-500 mt-1">Filmů v ročníku: {movies.length}</p>
          </div>
        </section>
      )}

      <button onClick={onLogout} className="text-gray-500 hover:text-white flex items-center gap-1"><LogOut size={12} /> Odhlásit administraci</button>
    </div>
  );
}

type Limits = Pick<Edition, 'plusVotes' | 'minusVotes' | 'winners'>;

function LimitsForm({ edition, onSave }: { edition: Edition; onSave: (limits: Limits) => void }) {
  const [limits, setLimits] = useState<Limits>({ plusVotes: edition.plusVotes, minusVotes: edition.minusVotes, winners: edition.winners });
  return (
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); onSave(limits); }}>
      {([['plusVotes', 'Kladných hlasů'], ['minusVotes', 'Záporných hlasů'], ['winners', 'Počet vítězů']] as const).map(([k, label]) => (
        <label key={k} className="text-gray-400">
          {label}
          <input type="number" min={0} max={50} value={limits[k]} onChange={e => setLimits({ ...limits, [k]: Math.max(0, Number(e.target.value) || 0) })} className={`${inputClass} w-24 block mt-1`} />
        </label>
      ))}
      <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded">Uložit</button>
    </form>
  );
}
