import { useEffect, useRef, useState } from 'react';
import { useDragDropManager, XYCoord } from 'react-dnd';
import { DragSource } from '../typings';

interface DragState {
  data: DragSource | null;
  isDragging: boolean;
  clientOffset: XYCoord | null;
}

const EMPTY_STATE: DragState = { data: null, isDragging: false, clientOffset: null };

export function useThrottledDragLayer(): DragState {
  const manager = useDragDropManager();
  const [state, setState] = useState<DragState>(EMPTY_STATE);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<DragState>(EMPTY_STATE);

  useEffect(() => {
    const monitor = manager.getMonitor();

    const tick = () => {
      rafRef.current = 0;
      const isDragging = monitor.isDragging();
      const data = monitor.getItem() as DragSource | null;
      const clientOffset = monitor.getClientOffset();

      const prev = lastRef.current;
      if (
        prev.isDragging === isDragging &&
        prev.data === data &&
        prev.clientOffset?.x === clientOffset?.x &&
        prev.clientOffset?.y === clientOffset?.y
      ) return;

      const next: DragState = { data, isDragging, clientOffset };
      lastRef.current = next;
      setState(next);
    };

    const unsubscribe = monitor.subscribeToOffsetChange(() => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    });

    const unsubDrag = monitor.subscribeToStateChange(() => {
      tick();
    });

    return () => {
      unsubscribe();
      unsubDrag();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [manager]);

  return state;
}
