'use client';

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Film } from 'lucide-react';
import { findPlayer, registerPlayer } from '@/lib/data';
import { cleanNickname, NICKNAME_MAX } from '@/lib/nickname';
import { describeError } from '@/lib/toast';
import type { Player } from '@/lib/types';
import { inputClass } from './ui';

export function LoginScreen({ onLogin }: { onLogin: (player: Player) => void }) {
  const [name, setName] = useState('');
  const [existing, setExisting] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanNickname(name);
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      const found = await findPlayer(clean);
      if (found) {
        setExisting(found);
      } else {
        onLogin(await registerPlayer(clean));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof FirebaseError && err.code === 'permission-denied'
        ? 'Databáze teď odmítá přístup. Dej vědět adminovi (pravidla Firestore).'
        : describeError(err, 'Přihlášení se nepovedlo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl">
        <div className="text-center mb-6">
          <Film className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-white">KUHO</h1>
          <p className="text-gray-400">Filmový víkend – hlasování</p>
        </div>

        {existing ? (
          <div className="space-y-4 text-center">
            <p className="text-gray-300">
              Přezdívku <span className="font-bold text-yellow-500">{existing.name}</span> už známe.
              <br />Vítej zpět! Jsi to ty?
            </p>
            <button onClick={() => onLogin(existing)} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded transition">
              Ano, pokračovat jako {existing.name}
            </button>
            <button onClick={() => setExisting(null)} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition">
              Ne, zvolím jinou přezdívku
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm text-gray-400" htmlFor="nickname">Tvoje přezdívka</label>
            <input
              id="nickname"
              type="text"
              autoFocus
              autoComplete="nickname"
              maxLength={NICKNAME_MAX}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="např. Pepa"
              className={`${inputClass} p-3`}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={!cleanNickname(name) || busy} className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold py-3 rounded transition">
              {busy ? 'Načítám…' : 'Vstoupit'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Na jiném zařízení stačí zadat stejnou přezdívku a uvidíš svoje nominace i hlasy.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
