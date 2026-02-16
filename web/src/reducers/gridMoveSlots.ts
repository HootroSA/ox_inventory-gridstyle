import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getTargetInventory, itemDurability } from '../helpers';
import { Inventory, InventoryType, Slot, SlotWithItem, State } from '../typings';

export const gridMoveSlotsReducer: CaseReducer<
  State,
  PayloadAction<{
    fromSlot: SlotWithItem;
    fromType: Inventory['type'];
    toType: Inventory['type'];
    toSlotId: number;
    count: number;
    toGridX: number;
    toGridY: number;
    rotated: boolean;
  }>
> = (state, action) => {
  const { fromSlot, fromType, toType, toSlotId, count, toGridX, toGridY, rotated } = action.payload;
  const { sourceInventory, targetInventory } = getTargetInventory(state, fromType, toType);
  const pieceWeight = fromSlot.weight / fromSlot.count;
  const curTime = Math.floor(Date.now() / 1000);
  const sourceIndex = sourceInventory.items.findIndex((i) => i.slot === fromSlot.slot);
  if (sourceIndex === -1) return;

  const fromItem = sourceInventory.items[sourceIndex];

  if (count >= fromSlot.count) {
    if (sourceInventory === targetInventory) {
      sourceInventory.items[sourceIndex] = {
        ...fromItem,
        count: count,
        weight: pieceWeight * count,
        gridX: toGridX,
        gridY: toGridY,
        rotated: rotated,
        durability: itemDurability(fromItem.metadata, curTime),
      } as SlotWithItem;
    } else {
      const movedItem: SlotWithItem = {
        ...fromItem,
        count: count,
        weight: pieceWeight * count,
        slot: toSlotId,
        gridX: toGridX,
        gridY: toGridY,
        rotated: rotated,
        durability: itemDurability(fromItem.metadata, curTime),
      } as SlotWithItem;

      targetInventory.items.push(movedItem);
      if (fromType !== InventoryType.SHOP && fromType !== InventoryType.CRAFTING) {
        sourceInventory.items.splice(sourceIndex, 1);
      }
    }
  } else {
    const newItem: SlotWithItem = {
      ...fromItem,
      count: count,
      weight: pieceWeight * count,
      slot: toSlotId,
      gridX: toGridX,
      gridY: toGridY,
      rotated: rotated,
      durability: itemDurability(fromItem.metadata, curTime),
    } as SlotWithItem;

    targetInventory.items.push(newItem);

    if (fromType !== InventoryType.SHOP && fromType !== InventoryType.CRAFTING) {
      sourceInventory.items[sourceIndex] = {
        ...fromItem,
        count: fromSlot.count - count,
        weight: pieceWeight * (fromSlot.count - count),
      };
    }
  }
};
