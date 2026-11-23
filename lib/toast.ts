'use client';

import { FirebaseError } from 'firebase/app';

export type ToastKind = 'error' | 'success' | 'info';
export interface ToastMessage { id: number; kind: ToastKind; text: string }

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function toast(text: string, kind: ToastKind = 'info') {
  const msg = { id: nextId++, kind, text };
  listeners.forEach(l => l(msg));
}

/** Human readable Czech message for Firebase / generic errors. */
export function describeError(error: unknown, fallback = 'Něco se pokazilo.'): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
      case 'firestore/permission-denied':
        return 'Tohle teď nejde – nemáš oprávnění, nebo se mezitím změnila fáze hlasování.';
      case 'unavailable':
      case 'firestore/unavailable':
        return 'Nejsi připojen k internetu. Zkus to znovu za chvíli.';
      case 'auth/network-request-failed':
        return 'Nepodařilo se spojit se serverem. Zkontroluj připojení.';
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return 'Anonymní přihlášení je ve Firebase vypnuté (Authentication → Sign-in method → Anonymous).';
      default:
        return `${fallback} (${error.code})`;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function toastError(error: unknown, fallback?: string) {
  console.error(error);
  toast(describeError(error, fallback), 'error');
}
