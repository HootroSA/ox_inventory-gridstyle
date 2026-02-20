import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getTargetInventory } from '../helpers';
import { Inventory, InventoryType, SlotWithItem, State } from '../typings';

export const gridStackSlotsReducer: CaseReducer<
  State,
  PayloadAction<{
    fromSlot: SlotWithItem;
    fromType: Inventory['type'];
    toSlot: SlotWithItem;
    toType: Inventory['type'];
    count: number;
  }>
> = (state, action) => {
  const { fromSlot, fromType, toSlot, toType, count } = action.payload;
  const { sourceInventory, targetInventory } = getTargetInventory(state, fromType, toType);
  const pieceWeight = fromSlot.weight / fromSlot.count;

  const sourceIndex = sourceInventory.items.findIndex((i) => i != null && i.slot === fromSlot.slot);
  const targetIndex = targetInventory.items.findIndex((i) => i != null && i.slot === toSlot.slot);

  if (targetIndex === -1) return;

  targetInventory.items[targetIndex] = {
    ...targetInventory.items[targetIndex],
    count: toSlot.count + count,
    weight: pieceWeight * (toSlot.count + count),
  };

  if (fromType === InventoryType.SHOP || fromType === InventoryType.CRAFTING) return;
  if (sourceIndex === -1) return;

  if (fromSlot.count - count > 0) {
    sourceInventory.items[sourceIndex] = {
      ...sourceInventory.items[sourceIndex],
      count: fromSlot.count - count,
      weight: pieceWeight * (fromSlot.count - count),
    };
  } else {
    sourceInventory.items.splice(sourceIndex, 1);
  }
};
