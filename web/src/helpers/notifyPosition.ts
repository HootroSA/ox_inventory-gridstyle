export type NotifyPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const STORAGE_KEY = 'ox_inv_notify_position';
const DEFAULT_POSITION: NotifyPosition = 'bottom-center';

const VALID: Set<string> = new Set([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]);

let listeners: Array<(pos: NotifyPosition) => void> = [];

export function getNotifyPosition(): NotifyPosition {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) return stored as NotifyPosition;
  } catch {}
  return DEFAULT_POSITION;
}

export function setNotifyPosition(pos: NotifyPosition): void {
  try {
    localStorage.setItem(STORAGE_KEY, pos);
  } catch {}
  listeners.forEach((fn) => fn(pos));
}

export function subscribeNotifyPosition(fn: (pos: NotifyPosition) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function stacksUpward(pos: NotifyPosition): boolean {
  return pos.startsWith('bottom');
}
