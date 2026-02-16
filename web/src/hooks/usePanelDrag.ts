import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface Position {
  x: number;
  y: number;
}

interface SavedState {
  position: Position | null;
  isLocked: boolean;
}

function loadState(key: string): SavedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;

    if (parsed.position) {
      parsed.position.x = Math.max(0, Math.min(parsed.position.x, window.innerWidth - 100));
      parsed.position.y = Math.max(0, Math.min(parsed.position.y, window.innerHeight - 100));
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveState(key: string, state: SavedState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {}
}

export function usePanelDrag(storageKey: string) {
  const saved = useMemo(() => loadState(storageKey), [storageKey]);

  const [position, setPosition] = useState<Position | null>(saved?.position ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState<boolean>(saved?.isLocked ?? true);
  const offsetRef = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDragging && position) {
      saveState(storageKey, { position, isLocked });
    }
  }, [isDragging]);

  useEffect(() => {
    saveState(storageKey, { position, isLocked });
  }, [isLocked]);

  const capturePosition = useCallback((): Position | null => {
    if (position) return position;
    const el = panelRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pos = { x: rect.left, y: rect.top };
    setPosition(pos);
    return pos;
  }, [position]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    if ((e.target as HTMLElement).closest('input, button, .grid-amount-selector, .panel-lock-btn')) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;

    const currentPos = position ?? (() => {
      const rect = panel.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    })();

    offsetRef.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    };
    setPosition(currentPos);
    setIsDragging(true);
  }, [position, isLocked]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const panel = panelRef.current;
      const pw = panel?.offsetWidth ?? 0;
      const ph = panel?.offsetHeight ?? 0;

      const x = Math.max(0, Math.min(e.clientX - offsetRef.current.x, window.innerWidth - pw));
      const y = Math.max(0, Math.min(e.clientY - offsetRef.current.y, window.innerHeight - ph));

      setPosition({ x, y });
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const reset = useCallback(() => {
    setPosition(null);
    setIsDragging(false);
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  return { position, setPosition, isDragging, isLocked, toggleLock, onMouseDown, panelRef, capturePosition, reset };
}
