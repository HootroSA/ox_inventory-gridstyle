import { createSelector, createSlice, current, isFulfilled, isPending, isRejected, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';
import {
  moveSlotsReducer,
  refreshSlotsReducer,
  setupInventoryReducer,
  stackSlotsReducer,
  swapSlotsReducer,
  gridMoveSlotsReducer,
  gridSwapSlotsReducer,
  gridStackSlotsReducer,
} from '../reducers';
import { setupGridInventory } from '../reducers/setupInventory';
import { Inventory, State } from '../typings';
import { CraftQueueItem } from '../typings/crafting';

const emptyInventory: Inventory = {
  id: '',
  type: '',
  slots: 0,
  maxWeight: 0,
  items: [],
};

const initialState: State = {
  leftInventory: { ...emptyInventory },
  rightInventory: { ...emptyInventory },
  backpackInventory: { ...emptyInventory },
  additionalMetadata: new Array(),
  itemAmount: 0,
  shiftPressed: false,
  isBusy: false,
  dragRotated: false,
  hotbar: [null, null, null, null, null],
  craftQueue: [],
  craftQueueProcessing: false,
  searchState: {
    searchingSlots: [],
  },
};

export const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    stackSlots: stackSlotsReducer,
    swapSlots: swapSlotsReducer,
    setupInventory: setupInventoryReducer,
    moveSlots: moveSlotsReducer,
    refreshSlots: refreshSlotsReducer,
    setAdditionalMetadata: (state, action: PayloadAction<Array<{ metadata: string; value: string }>>) => {
      const metadata = [];

      for (let i = 0; i < action.payload.length; i++) {
        const entry = action.payload[i];
        if (!state.additionalMetadata.find((el) => el.value === entry.value)) metadata.push(entry);
      }

      state.additionalMetadata = [...state.additionalMetadata, ...metadata];
    },
    setItemAmount: (state, action: PayloadAction<number>) => {
      state.itemAmount = action.payload;
    },
    setShiftPressed: (state, action: PayloadAction<boolean>) => {
      state.shiftPressed = action.payload;
    },
    setContainerWeight: (state, action: PayloadAction<number>) => {
      const container = state.leftInventory.items.find((item) => item != null && item.metadata?.container === state.rightInventory.id);

      if (!container) return;

      container.weight = action.payload;
    },
    gridMoveSlots: gridMoveSlotsReducer,
    gridSwapSlots: gridSwapSlotsReducer,
    gridStackSlots: gridStackSlotsReducer,
    toggleDragRotation: (state) => {
      state.dragRotated = !state.dragRotated;
    },
    setDragRotated: (state, action: PayloadAction<boolean>) => {
      state.dragRotated = action.payload;
    },
    assignHotbar: (state, action: PayloadAction<{ hotbarSlot: number; itemSlot: number | null }>) => {
      const { hotbarSlot, itemSlot } = action.payload;
      if (hotbarSlot < 0 || hotbarSlot > 4) return;
      if (itemSlot !== null) {
        for (let i = 0; i < state.hotbar.length; i++) {
          if (state.hotbar[i] === itemSlot) state.hotbar[i] = null;
        }
      }
      state.hotbar[hotbarSlot] = itemSlot;
    },
    clearHotbar: (state, action: PayloadAction<number>) => {
      if (action.payload >= 0 && action.payload <= 4) {
        state.hotbar[action.payload] = null;
      }
    },
    restoreHotbar: (state, action: PayloadAction<(number | null)[]>) => {
      state.hotbar = action.payload;
    },
    removePlayerItem: (state, action: PayloadAction<number>) => {
      state.leftInventory.items = state.leftInventory.items.filter((i) => i != null && i.slot !== action.payload);
    },
    removeBackpackItem: (state, action: PayloadAction<number>) => {
      state.backpackInventory.items = state.backpackInventory.items.filter((i) => i != null && i.slot !== action.payload);
    },
    setupBackpack: (state, action: PayloadAction<Inventory>) => {
      const curTime = Math.floor(Date.now() / 1000);
      state.backpackInventory = setupGridInventory(action.payload, curTime);
    },
    closeBackpack: (state) => {
      state.backpackInventory = { id: '', type: '', slots: 0, maxWeight: 0, items: [] };
    },
    setBackpackWeight: (state, action: PayloadAction<number>) => {
      const backpackItem = state.leftInventory.items.find(
        (item) => item != null && item.metadata?.container === state.backpackInventory.id
      );
      if (backpackItem) backpackItem.weight = action.payload;
    },
    addToCraftQueue: (state, action: PayloadAction<{
      recipeSlot: number;
      itemName: string;
      label: string;
      duration: number;
      count: number;
    }>) => {
      const { recipeSlot, itemName, label, duration, count } = action.payload;
      const existing = state.craftQueue.find((q) => q.recipeSlot === recipeSlot && q.status !== 'done');
      if (existing) {
        existing.totalCount += count;
      } else {
        state.craftQueue.push({
          queueId: crypto.randomUUID(),
          recipeSlot,
          itemName,
          label,
          totalCount: count,
          completedCount: 0,
          failedCount: 0,
          status: 'queued',
          duration,
          craftStartedAt: null,
          pendingCraftIds: [],
        });
      }
    },
    updateCraftQueueItem: (state, action: PayloadAction<{ queueId: string; updates: Partial<CraftQueueItem> }>) => {
      const item = state.craftQueue.find((q) => q.queueId === action.payload.queueId);
      if (item) Object.assign(item, action.payload.updates);
    },
    completeSingleCraft: (state, action: PayloadAction<{ queueId: string; pendingCraftId: string }>) => {
      const item = state.craftQueue.find((q) => q.queueId === action.payload.queueId);
      if (!item) return;
      item.completedCount += 1;
      item.pendingCraftIds.push(action.payload.pendingCraftId);
      item.craftStartedAt = null;
      if (item.completedCount + item.failedCount >= item.totalCount) {
        item.status = 'done';
      } else {
        item.status = 'queued';
      }
    },
    failSingleCraft: (state, action: PayloadAction<{ queueId: string }>) => {
      const item = state.craftQueue.find((q) => q.queueId === action.payload.queueId);
      if (!item) return;
      item.failedCount += 1;
      item.craftStartedAt = null;
      if (item.completedCount + item.failedCount >= item.totalCount) {
        item.status = 'done';
        if (item.completedCount === 0) item.error = 'All crafts failed';
      } else {
        item.status = 'queued';
      }
    },
    removeCraftQueueItem: (state, action: PayloadAction<string>) => {
      state.craftQueue = state.craftQueue.filter((q) => q.queueId !== action.payload);
    },
    setCraftQueueProcessing: (state, action: PayloadAction<boolean>) => {
      state.craftQueueProcessing = action.payload;
    },
    clearCraftQueue: (state) => {
      state.craftQueue = [];
      state.craftQueueProcessing = false;
    },
    attachComponentToWeapon: (
      state,
      action: PayloadAction<{
        componentSlot: number;
        weaponSlot: number;
        componentName: string;
        sourceInvId: string;
        targetInvId: string;
      }>
    ) => {
      const { componentSlot, weaponSlot, componentName, sourceInvId, targetInvId } = action.payload;

      const sourceInv =
        state.leftInventory.id === sourceInvId
          ? state.leftInventory
          : state.backpackInventory.id === sourceInvId
          ? state.backpackInventory
          : state.rightInventory;

      sourceInv.items = sourceInv.items.filter((i) => i != null && i.slot !== componentSlot);

      const targetInv =
        state.leftInventory.id === targetInvId
          ? state.leftInventory
          : state.backpackInventory.id === targetInvId
          ? state.backpackInventory
          : state.rightInventory;

      const weapon = targetInv.items.find((i) => i != null && i.slot === weaponSlot);
      if (weapon) {
        if (!weapon.metadata) weapon.metadata = {};
        if (!weapon.metadata.components) weapon.metadata.components = [];
        weapon.metadata.components.push(componentName);
      }
    },
    beginItemSearch: (state, action: PayloadAction<number>) => {
      if (!state.searchState.searchingSlots.includes(action.payload)) {
        state.searchState.searchingSlots.push(action.payload);
      }
    },
    finishItemSearch: (state, action: PayloadAction<number>) => {
      state.searchState.searchingSlots = state.searchState.searchingSlots.filter((s) => s !== action.payload);
      const item = state.rightInventory.items.find((i) => i != null && i.slot === action.payload);
      if (item) item.searched = true;
    },
  },
  extraReducers: (builder) => {
    const isNonCraftingPending = (action: any) => isPending(action) && !action.type.startsWith('crafting/');
    const isNonCraftingFulfilled = (action: any) => isFulfilled(action) && !action.type.startsWith('crafting/');
    const isNonCraftingRejected = (action: any) => isRejected(action) && !action.type.startsWith('crafting/');

    builder.addMatcher(isNonCraftingPending, (state) => {
      state.isBusy = true;

      state.history = {
        leftInventory: current(state.leftInventory),
        rightInventory: current(state.rightInventory),
        backpackInventory: current(state.backpackInventory),
      };
    });
    builder.addMatcher(isNonCraftingFulfilled, (state) => {
      state.isBusy = false;
    });
    builder.addMatcher(isNonCraftingRejected, (state) => {
      if (state.history && state.history.leftInventory && state.history.rightInventory) {
        state.leftInventory = state.history.leftInventory;
        state.rightInventory = state.history.rightInventory;
        if (state.history.backpackInventory) {
          state.backpackInventory = state.history.backpackInventory;
        }
      }
      state.isBusy = false;
    });
  },
});

export const {
  setAdditionalMetadata,
  setItemAmount,
  setShiftPressed,
  setupInventory,
  swapSlots,
  moveSlots,
  stackSlots,
  refreshSlots,
  setContainerWeight,
  gridMoveSlots,
  gridSwapSlots,
  gridStackSlots,
  toggleDragRotation,
  setDragRotated,
  assignHotbar,
  clearHotbar,
  restoreHotbar,
  removePlayerItem,
  removeBackpackItem,
  setupBackpack,
  closeBackpack,
  setBackpackWeight,
  addToCraftQueue,
  updateCraftQueueItem,
  completeSingleCraft,
  failSingleCraft,
  removeCraftQueueItem,
  setCraftQueueProcessing,
  clearCraftQueue,
  attachComponentToWeapon,
  beginItemSearch,
  finishItemSearch,
} = inventorySlice.actions;
export const selectLeftInventory = (state: RootState) => state.inventory.leftInventory;
export const selectRightInventory = (state: RootState) => state.inventory.rightInventory;
export const selectBackpackInventory = (state: RootState) => state.inventory.backpackInventory;
export const selectItemAmount = (state: RootState) => state.inventory.itemAmount;
export const selectIsBusy = (state: RootState) => state.inventory.isBusy;
export const selectDragRotated = (state: RootState) => state.inventory.dragRotated;
export const selectHotbar = (state: RootState) => state.inventory.hotbar;
export const selectCraftQueue = (state: RootState) => state.inventory.craftQueue;
export const selectCraftQueueProcessing = (state: RootState) => state.inventory.craftQueueProcessing;
export const selectSearchState = (state: RootState) => state.inventory.searchState;

export const selectPlayerItemCounts = createSelector(
  [(state: RootState) => state.inventory.leftInventory.items],
  (items): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.name) {
        counts[item.name] = (counts[item.name] || 0) + (item.count ?? 0);
      }
    }
    return counts;
  }
);

export default inventorySlice.reducer;
