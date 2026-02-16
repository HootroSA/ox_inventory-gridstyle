import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { itemDurability } from '../helpers';
import { isGridInventory, buildOccupancyGrid, canPlaceItem, findFirstFit, getEffectiveDimensions, getSlotEffectiveSize, OccupancyGrid } from '../helpers/gridUtils';
import { DEFAULT_GRID_DIMENSIONS } from '../helpers/gridConstants';
import { inventorySlice } from '../store/inventory';
import { Items } from '../store/items';
import { InventoryType, Slot, SlotWithItem, State } from '../typings';
import { ItemSize } from '../typings/grid';

export type ItemsPayload = { item: Slot; inventory?: InventoryType };

interface Payload {
  items?: ItemsPayload | ItemsPayload[];
  itemCount?: Record<string, number>;
  weightData?: { inventoryId: string; maxWeight: number };
  slotsData?: { inventoryId: string; slots: number };
}

export const refreshSlotsReducer: CaseReducer<State, PayloadAction<Payload>> = (state, action) => {
  if (action.payload.items) {
    if (!Array.isArray(action.payload.items)) action.payload.items = [action.payload.items];
    const curTime = Math.floor(Date.now() / 1000);

    const itemSizes: Record<string, ItemSize | undefined> = {};
    for (const [name, d] of Object.entries(Items)) {
      if (d) itemSizes[name] = { width: d.width ?? 1, height: d.height ?? 1 };
    }

    const occupancyCache: Record<string, OccupancyGrid> = {};

    const getOccupancy = (inv: typeof state.leftInventory, key: string) => {
      if (!occupancyCache[key]) {
        const gw = inv.gridWidth ?? DEFAULT_GRID_DIMENSIONS[inv.type]?.gridWidth ?? 10;
        const gh = inv.gridHeight ?? DEFAULT_GRID_DIMENSIONS[inv.type]?.gridHeight ?? 5;
        occupancyCache[key] = buildOccupancyGrid(gw, gh, inv.items, itemSizes);
      }
      return occupancyCache[key];
    };

    Object.values(action.payload.items)
      .filter((data) => !!data)
      .forEach((data) => {
        const targetInventory = data.inventory
          ? data.inventory === InventoryType.PLAYER || data.inventory === state.leftInventory.id
            ? state.leftInventory
            : data.inventory === InventoryType.BACKPACK || (state.backpackInventory.id && data.inventory === state.backpackInventory.id)
            ? state.backpackInventory
            : state.rightInventory
          : state.leftInventory;

        const invKey = targetInventory === state.leftInventory ? 'left'
          : targetInventory === state.backpackInventory ? 'backpack' : 'right';

        data.item.durability = itemDurability(data.item.metadata, curTime);

        if ((data.item as any).gridRotated !== undefined && data.item.rotated === undefined) {
          data.item.rotated = (data.item as any).gridRotated;
        }

        if (isGridInventory(targetInventory.type)) {
          const existingIndex = targetInventory.items.findIndex((i) => i.slot === data.item.slot);
          if (data.item.name) {
            if (existingIndex !== -1) {
              const existing = targetInventory.items[existingIndex];
              if (data.item.gridX === undefined && existing.gridX !== undefined) {
                data.item.gridX = existing.gridX;
                data.item.gridY = existing.gridY;
                data.item.rotated = existing.rotated;
              }
              if ((existing as any).price !== undefined && (data.item as any).price === undefined) {
                (data.item as any).price = (existing as any).price;
                (data.item as any).currency = (existing as any).currency;
              }
              if ((existing as any).ingredients && !(data.item as any).ingredients) {
                (data.item as any).ingredients = (existing as any).ingredients;
                (data.item as any).duration = (existing as any).duration;
              }
              targetInventory.items[existingIndex] = data.item;
            } else {
              const gw = targetInventory.gridWidth ?? DEFAULT_GRID_DIMENSIONS[targetInventory.type]?.gridWidth ?? 10;
              const gh = targetInventory.gridHeight ?? DEFAULT_GRID_DIMENSIONS[targetInventory.type]?.gridHeight ?? 5;
              const occupancy = getOccupancy(targetInventory, invKey);
              const effSize = getSlotEffectiveSize(data.item, itemSizes);
              const rotated = data.item.rotated ?? false;
              const { width: effW, height: effH } = getEffectiveDimensions(effSize, rotated);

              if (
                data.item.gridX === undefined ||
                data.item.gridY === undefined ||
                !canPlaceItem(occupancy, gw, gh, data.item.gridX, data.item.gridY, effW, effH)
              ) {
                const fit = findFirstFit(occupancy, gw, gh, effSize.width, effSize.height);
                if (fit) {
                  data.item.gridX = fit.x;
                  data.item.gridY = fit.y;
                  data.item.rotated = fit.rotated;
                }
              }

              if (data.item.gridX !== undefined && data.item.gridY !== undefined) {
                const placedRotated = data.item.rotated ?? false;
                const { width: pW, height: pH } = getEffectiveDimensions(effSize, placedRotated);
                for (let dy = 0; dy < pH; dy++) {
                  for (let dx = 0; dx < pW; dx++) {
                    const cx = data.item.gridX + dx;
                    const cy = data.item.gridY + dy;
                    if (cy < gh && cx < gw && occupancy[cy]) {
                      occupancy[cy][cx] = data.item.slot;
                    }
                  }
                }
              }

              targetInventory.items.push(data.item);
            }
          } else {
            if (existingIndex !== -1) {
              targetInventory.items.splice(existingIndex, 1);
              delete occupancyCache[invKey];
            }
          }
        } else {
          targetInventory.items[data.item.slot - 1] = data.item;
        }
      });

    if (state.rightInventory.type === InventoryType.CRAFTING) {
      state.rightInventory = { ...state.rightInventory };
    }
  }

  if (action.payload.itemCount) {
    const items = Object.entries(action.payload.itemCount);

    for (let i = 0; i < items.length; i++) {
      const item = items[i][0];
      const count = items[i][1];

      if (Items[item]!) {
        Items[item]!.count += count;
      } else console.log(`Item data for ${item} is undefined`);
    }
  }

  if (action.payload.weightData) {
    const inventoryId = action.payload.weightData.inventoryId;
    const inventoryMaxWeight = action.payload.weightData.maxWeight;
    const inv =
      inventoryId === state.leftInventory.id
        ? 'leftInventory'
        : inventoryId === state.rightInventory.id
        ? 'rightInventory'
        : inventoryId === state.backpackInventory.id
        ? 'backpackInventory'
        : null;

    if (!inv) return;

    state[inv].maxWeight = inventoryMaxWeight;
  }

  if (action.payload.slotsData) {
    const { inventoryId } = action.payload.slotsData;
    const { slots } = action.payload.slotsData;

    const inv =
      inventoryId === state.leftInventory.id
        ? 'leftInventory'
        : inventoryId === state.rightInventory.id
        ? 'rightInventory'
        : inventoryId === state.backpackInventory.id
        ? 'backpackInventory'
        : null;

    if (!inv) return;

    state[inv].slots = slots;
    inventorySlice.caseReducers.setupInventory(state, {
      type: 'setupInventory',
      payload: {
        leftInventory: inv === 'leftInventory' ? state[inv] : undefined,
        rightInventory: inv === 'rightInventory' ? state[inv] : undefined,
      },
    });
  }
};
