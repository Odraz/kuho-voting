'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { subscribeToasts, type ToastMessage } from '@/lib/toast';

export function Spinner({ label = 'Načítám…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-gray-400 py-10">
      <Loader2 className="animate-spin" size={20} /> {label}
    </div>
  );
}

export function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center text-gray-200">
      <div className="max-w-md space-y-4">{children}</div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, message, confirmLabel = 'Ano, smazat', onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-gray-800 p-6 rounded-xl max-w-sm w-full border border-gray-600 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 text-yellow-500 mb-4">
          <AlertTriangle size={24} />
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">Zrušit</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const TOAST_STYLES = {
  error: 'bg-red-950 border-red-700 text-red-100',
  success: 'bg-green-950 border-green-700 text-green-100',
  info: 'bg-gray-800 border-gray-600 text-gray-100',
};
const TOAST_ICONS = { error: AlertTriangle, success: CheckCircle2, info: Info };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(t => {
    setToasts(prev => [...prev.slice(-3), t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.kind === 'error' ? 7000 : 3500);
  }), []);

  return (
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:w-96 z-[70] space-y-2">
      {toasts.map(t => {
        const Icon = TOAST_ICONS[t.kind];
        return (
          <div key={t.id} role="status" className={`flex items-start gap-3 p-3 rounded-lg border shadow-xl ${TOAST_STYLES[t.kind]}`}>
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{t.text}</p>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-60 hover:opacity-100" aria-label="Zavřít"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}

export const inputClass = 'w-full p-2.5 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-yellow-500 outline-none';
