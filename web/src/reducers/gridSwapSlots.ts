import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getTargetInventory, itemDurability } from '../helpers';
import { Inventory, SlotWithItem, State } from '../typings';

export const gridSwapSlotsReducer: CaseReducer<
  State,
  PayloadAction<{
    fromSlot: SlotWithItem;
    fromType: Inventory['type'];
    toSlot: SlotWithItem;
    toType: Inventory['type'];
    dragRotated?: boolean;
    rotateTarget?: boolean;
  }>
> = (state, action) => {
  const { fromSlot, fromType, toSlot, toType, dragRotated, rotateTarget } = action.payload;
  const { sourceInventory, targetInventory } = getTargetInventory(state, fromType, toType);
  const curTime = Math.floor(Date.now() / 1000);

  const sourceIndex = sourceInventory.items.findIndex((i) => i.slot === fromSlot.slot);
  const targetIndex = targetInventory.items.findIndex((i) => i.slot === toSlot.slot);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const sourceItem = sourceInventory.items[sourceIndex];
  const targetItem = targetInventory.items[targetIndex];

  const fromGridX = sourceItem.gridX;
  const fromGridY = sourceItem.gridY;

  const targetRotation = rotateTarget
    ? !(targetItem.rotated ?? false)
    : targetItem.rotated;

  if (sourceInventory === targetInventory) {
    sourceInventory.items[sourceIndex] = {
      ...sourceItem,
      gridX: targetItem.gridX,
      gridY: targetItem.gridY,
      rotated: dragRotated ?? sourceItem.rotated,
      durability: itemDurability(fromSlot.metadata, curTime),
    };

    targetInventory.items[targetIndex] = {
      ...targetItem,
      gridX: fromGridX,
      gridY: fromGridY,
      rotated: targetRotation,
      durability: itemDurability(toSlot.metadata, curTime),
    };
  } else {
    const movedSource = {
      ...sourceItem,
      slot: toSlot.slot,
      gridX: targetItem.gridX,
      gridY: targetItem.gridY,
      rotated: dragRotated ?? sourceItem.rotated,
      durability: itemDurability(fromSlot.metadata, curTime),
    };

    const movedTarget = {
      ...targetItem,
      slot: fromSlot.slot,
      gridX: fromGridX,
      gridY: fromGridY,
      rotated: targetRotation,
      durability: itemDurability(toSlot.metadata, curTime),
    };

    sourceInventory.items.splice(sourceIndex, 1);
    targetInventory.items.splice(targetIndex, 1);

    targetInventory.items.push(movedSource);
    sourceInventory.items.push(movedTarget);
  }
};
