import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getItemData, itemDurability } from '../helpers';
import { isGridInventory, buildOccupancyGrid, findFirstFit, getItemSize, getSlotEffectiveSize, canPlaceItem, getEffectiveDimensions } from '../helpers/gridUtils';
import { DEFAULT_GRID_DIMENSIONS } from '../helpers/gridConstants';
import { Items } from '../store/items';
import { Inventory, Slot, State } from '../typings';
import { getItemSizes } from '../helpers/itemSizeCache';

export function setupGridInventory(inventory: Inventory, curTime: number): Inventory {
  const defaults = DEFAULT_GRID_DIMENSIONS[inventory.type];
  let gridWidth = inventory.gridWidth ?? defaults?.gridWidth ?? 10;
  let gridHeight = inventory.gridHeight ?? defaults?.gridHeight ?? 5;
  const itemSizes = getItemSizes();

  const rawItems = Object.values(inventory.items).filter(
    (item): item is Slot & { name: string } => item?.name !== undefined
  );

  const processedItems: Slot[] = [];

  const occupancy = buildOccupancyGrid(gridWidth, gridHeight, [], itemSizes);

  for (const item of rawItems) {
    if (typeof Items[item.name] === 'undefined') {
      getItemData(item.name);
    }
    item.durability = itemDurability(item.metadata, curTime);

    if ((item as any).gridRotated !== undefined && item.rotated === undefined) {
      item.rotated = (item as any).gridRotated;
    }

    const size = getSlotEffectiveSize(item, itemSizes);

    if (item.gridX !== undefined && item.gridY !== undefined) {
      const { width: effW, height: effH } = getEffectiveDimensions(size, item.rotated ?? false);
      if (!canPlaceItem(occupancy, gridWidth, gridHeight, item.gridX, item.gridY, effW, effH)) {
        const fit = findFirstFit(occupancy, gridWidth, gridHeight, size.width, size.height);
        if (fit) {
          item.gridX = fit.x;
          item.gridY = fit.y;
          item.rotated = fit.rotated;
        }
      }
    } else {
      const fit = findFirstFit(occupancy, gridWidth, gridHeight, size.width, size.height);
      if (fit) {
        item.gridX = fit.x;
        item.gridY = fit.y;
        item.rotated = fit.rotated;
      }
    }

    if (item.gridX !== undefined && item.gridY !== undefined) {
      const { width: effW, height: effH } = getEffectiveDimensions(size, item.rotated ?? false);
      for (let dy = 0; dy < effH; dy++) {
        for (let dx = 0; dx < effW; dx++) {
          const cx = item.gridX + dx;
          const cy = item.gridY + dy;
          if (cy < gridHeight && cx < gridWidth && occupancy[cy]) {
            occupancy[cy][cx] = item.slot;
          }
        }
      }
      processedItems.push(item);
    }
  }

  return {
    ...inventory,
    gridWidth,
    gridHeight,
    items: processedItems,
  };
}

function setupSlotInventory(inventory: Inventory, curTime: number): Inventory {
  return {
    ...inventory,
    items: Array.from(Array(inventory.slots), (_, index) => {
      const item = Object.values(inventory.items).find((item) => item?.slot === index + 1) || {
        slot: index + 1,
      };

      if (!item.name) return item;

      if (typeof Items[item.name] === 'undefined') {
        getItemData(item.name);
      }

      item.durability = itemDurability(item.metadata, curTime);
      return item;
    }),
  };
}

export const setupInventoryReducer: CaseReducer<
  State,
  PayloadAction<{
    leftInventory?: Inventory;
    rightInventory?: Inventory;
  }>
> = (state, action) => {
  const { leftInventory, rightInventory } = action.payload;
  const curTime = Math.floor(Date.now() / 1000);

  if (leftInventory) {
    state.leftInventory = isGridInventory(leftInventory.type)
      ? setupGridInventory(leftInventory, curTime)
      : setupSlotInventory(leftInventory, curTime);
  }

  if (rightInventory) {
    state.rightInventory = isGridInventory(rightInventory.type)
      ? setupGridInventory(rightInventory, curTime)
      : setupSlotInventory(rightInventory, curTime);
  }

  state.shiftPressed = false;
  state.isBusy = false;
  state.searchState = { searchingSlots: [] };
};
