import React, { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { Inventory, InventoryType } from '../../typings';
import { DragSource } from '../../typings/dnd';
import { useAppSelector, useAppDispatch } from '../../store';
import { store } from '../../store';
import {
  selectCraftQueue,
  selectItemAmount,
  addToCraftQueue,
} from '../../store/inventory';
import { Items } from '../../store/items';
import { isSlotWithItem, canCraftItem, canCraftItemWithReservations } from '../../helpers';
import { useCraftQueueProcessor } from '../../hooks/useCraftQueueProcessor';
import CraftQueueCard from './CraftQueueCard';
import GridInventory from './GridInventory';

interface Props {
  inventory: Inventory;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const CraftingInventory: React.FC<Props> = ({ inventory, onHeaderMouseDown, isLocked, onToggleLock }) => {
  const dispatch = useAppDispatch();
  const craftQueue = useAppSelector(selectCraftQueue);
  const itemAmount = useAppSelector(selectItemAmount);

  useCraftQueueProcessor();

  const handleQueueDrop = useCallback(
    (source: DragSource) => {
      if (source.inventory !== InventoryType.CRAFTING) return;

      const { inventory: reduxState } = store.getState();
      const craftInv = reduxState.rightInventory;
      const sourceSlot = craftInv.items.find((i) => i != null && i.slot === source.item.slot);
      if (!sourceSlot || !isSlotWithItem(sourceSlot)) return;

      if (!canCraftItem(sourceSlot, craftInv.type)) return;

      const requestedCount = itemAmount === 0 ? 1 : itemAmount;

      const reserved: Record<string, number> = {};
      for (const q of reduxState.craftQueue) {
        if (q.status === 'done') continue;
        const recipeSlot = craftInv.items.find((s) => s != null && s.slot === q.recipeSlot);
        if (!recipeSlot || !isSlotWithItem(recipeSlot) || !recipeSlot.ingredients) continue;
        const remaining = q.totalCount - q.completedCount - q.failedCount;
        for (const [name, needed] of Object.entries(recipeSlot.ingredients)) {
          if (needed >= 1) reserved[name] = (reserved[name] || 0) + needed * remaining;
        }
      }

      let validCount = 0;
      for (let i = 0; i < requestedCount; i++) {
        if (!canCraftItemWithReservations(sourceSlot, craftInv.type, reserved)) break;
        validCount++;
      }

      if (validCount === 0) return;

      dispatch(
        addToCraftQueue({
          recipeSlot: sourceSlot.slot,
          itemName: sourceSlot.name,
          label: (sourceSlot as any).metadata?.label || Items[sourceSlot.name]?.label || sourceSlot.name,
          duration: (sourceSlot as any).duration || 3000,
          count: validCount,
        })
      );
    },
    [dispatch, itemAmount]
  );

  const [{ isOver }, queueDropRef] = useDrop<DragSource, void, { isOver: boolean }>(
    () => ({
      accept: ['GRID_ITEM'],
      drop: (source, monitor) => {
        if (monitor.didDrop()) return;
        handleQueueDrop(source);
      },
      canDrop: (source) => source.inventory === InventoryType.CRAFTING,
      collect: (monitor) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [handleQueueDrop]
  );

  const isEmpty = craftQueue.length === 0;

  return (
    <div className="crafting-inventory-wrapper">
      <div className="crafting-recipe-grid-container">
        <GridInventory
          inventory={inventory}
          onHeaderMouseDown={onHeaderMouseDown}
          isLocked={isLocked}
          onToggleLock={onToggleLock}
        />
      </div>

      <div
        ref={queueDropRef}
        className={`craft-queue-zone${isOver ? ' craft-queue-zone--active' : ''}${isEmpty ? ' craft-queue-zone--empty' : ''}`}
      >
        {!isEmpty && (
          <div className="craft-queue-header">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>QUEUE</span>
            <span className="craft-queue-header-count">{craftQueue.length}</span>
          </div>
        )}
        {isEmpty ? (
          <div className="craft-queue-placeholder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
            <span>Drag recipe here to craft</span>
          </div>
        ) : (
          <div className="craft-queue-grid">
            {craftQueue.map((item) => (
              <CraftQueueCard key={item.queueId} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CraftingInventory;
