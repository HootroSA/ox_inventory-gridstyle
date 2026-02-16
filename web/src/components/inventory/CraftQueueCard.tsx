import React, { useState, useEffect, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { CraftQueueItem } from '../../typings/crafting';
import { getItemUrl } from '../../helpers';
import { Items } from '../../store/items';

interface Props {
  item: CraftQueueItem;
}

const CraftQueueCard: React.FC<Props> = ({ item }) => {
  const [timeLeft, setTimeLeft] = useState<number>(item.duration);

  useEffect(() => {
    if (item.status !== 'crafting' || !item.craftStartedAt) {
      setTimeLeft(item.duration);
      return;
    }

    let mounted = true;

    const interval = setInterval(() => {
      if (!mounted) return;
      const elapsed = Date.now() - item.craftStartedAt!;
      const remaining = Math.max(0, item.duration - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [item.status, item.craftStartedAt, item.duration]);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'CRAFT_DONE_ITEM',
      item: () => ({
        queueId: item.queueId,
        pendingCraftIds: item.pendingCraftIds,
        itemName: item.itemName,
        totalCount: item.completedCount,
        item: { name: item.itemName, slot: -1 },
        image: `url(${getItemUrl(item.itemName) || 'none'}`,
        width: Items[item.itemName]?.width ?? 1,
        height: Items[item.itemName]?.height ?? 1,
      }),
      canDrag: () => item.status === 'done' && item.completedCount > 0,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [item]
  );

  const imageUrl = getItemUrl(item.itemName) || 'none';

  const progressPercent = useMemo(() => {
    if (item.status === 'done') return 100;
    const base = item.totalCount > 0
      ? ((item.completedCount + item.failedCount) / item.totalCount) * 100
      : 0;
    if (item.status !== 'crafting' || !item.craftStartedAt) return base;
    const craftProgress = Math.min(1, (Date.now() - item.craftStartedAt) / item.duration);
    return base + (craftProgress / item.totalCount) * 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.status, item.craftStartedAt, item.totalCount, item.completedCount, item.failedCount, item.duration, timeLeft]);

  const hasError = item.status === 'done' && item.completedCount === 0 && item.failedCount > 0;
  const hasPartialError = item.status === 'done' && item.failedCount > 0 && item.completedCount > 0;

  return (
    <div
      ref={item.status === 'done' && item.completedCount > 0 ? drag : undefined}
      className={`craft-queue-cell craft-queue-cell--${item.status}${hasError ? ' craft-queue-cell--error' : ''}${hasPartialError ? ' craft-queue-cell--partial' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="craft-queue-cell-image" style={{ backgroundImage: `url(${imageUrl})` }} />

      {/* Count badge top-left */}
      {item.totalCount > 1 && (
        <div className="craft-queue-cell-count">{item.totalCount}x</div>
      )}

      {/* Status badge top-right */}
      <div className="craft-queue-cell-badge">
        {item.status === 'queued' && (
          <span className="craft-queue-cell-badge-text craft-queue-cell-badge-text--queued">
            {item.completedCount > 0 ? `${item.completedCount}/${item.totalCount}` : '...'}
          </span>
        )}
        {item.status === 'crafting' && (
          <span className="craft-queue-cell-badge-text craft-queue-cell-badge-text--crafting">
            {item.totalCount > 1 ? `${item.completedCount + 1}/${item.totalCount}` : `${(timeLeft / 1000).toFixed(1)}s`}
          </span>
        )}
        {item.status === 'done' && (
          <span className={`craft-queue-cell-badge-text ${
            hasError ? 'craft-queue-cell-badge-text--fail'
            : hasPartialError ? 'craft-queue-cell-badge-text--partial'
            : 'craft-queue-cell-badge-text--done'
          }`}>
            {hasError ? 'FAIL' : hasPartialError ? `${item.completedCount}/${item.totalCount}` : 'DONE'}
          </span>
        )}
      </div>

      {/* Label at bottom */}
      <div className="craft-queue-cell-footer">
        <span className="craft-queue-cell-label">{item.label}</span>
      </div>

      {/* Progress bar overlay — fills from bottom to top */}
      {(item.status === 'crafting' || (item.status === 'queued' && item.completedCount > 0)) && (
        <div className="craft-queue-cell-progress">
          <div
            className="craft-queue-cell-progress-bar"
            style={{ height: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(CraftQueueCard, (prev, next) =>
  prev.item.queueId === next.item.queueId &&
  prev.item.status === next.item.status &&
  prev.item.completedCount === next.item.completedCount &&
  prev.item.failedCount === next.item.failedCount &&
  prev.item.craftStartedAt === next.item.craftStartedAt &&
  prev.item.pendingCraftIds.length === next.item.pendingCraftIds.length
);
