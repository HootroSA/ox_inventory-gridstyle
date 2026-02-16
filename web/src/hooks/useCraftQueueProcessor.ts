import { useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectCraftQueue,
  selectCraftQueueProcessing,
  updateCraftQueueItem,
  setCraftQueueProcessing,
  completeSingleCraft,
  failSingleCraft,
} from '../store/inventory';
import { startCraftQueueItem } from '../thunks/craftQueue';

export function useCraftQueueProcessor() {
  const dispatch = useAppDispatch();
  const queue = useAppSelector(selectCraftQueue);
  const processing = useAppSelector(selectCraftQueueProcessing);
  const queueRef = useRef(queue);
  const processingRef = useRef(false);
  const cancelledRef = useRef(false);

  const pendingCount = useMemo(
    () => queue.reduce((sum, item) => sum + Math.max(0, item.totalCount - item.completedCount - item.failedCount), 0),
    [queue]
  );

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (processingRef.current) return;

    const currentQueue = queueRef.current;
    const nextGroup = currentQueue.find(
      (item) => item.status === 'queued' && item.completedCount + item.failedCount < item.totalCount
    );
    if (!nextGroup) return;

    dispatch(setCraftQueueProcessing(true));

    const processItem = async () => {
      if (cancelledRef.current) return;

      dispatch(
        updateCraftQueueItem({
          queueId: nextGroup.queueId,
          updates: { status: 'crafting', craftStartedAt: Date.now() },
        })
      );

      const result = await dispatch(
        startCraftQueueItem({
          queueId: nextGroup.queueId,
          recipeSlot: nextGroup.recipeSlot,
        })
      );

      if (cancelledRef.current) return;

      if (startCraftQueueItem.fulfilled.match(result)) {
        dispatch(
          completeSingleCraft({
            queueId: nextGroup.queueId,
            pendingCraftId: result.payload.pendingCraftId,
          })
        );
      } else {
        dispatch(failSingleCraft({ queueId: nextGroup.queueId }));
      }

      if (!cancelledRef.current) {
        dispatch(setCraftQueueProcessing(false));
      }
    };

    processItem();
  }, [processing, pendingCount, dispatch]);
}
