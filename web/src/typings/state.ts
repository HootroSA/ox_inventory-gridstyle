import { Inventory } from './inventory';
import { Slot } from './slot';
import { CraftQueueItem } from './crafting';

export type SearchState = {
  searchingSlots: number[];
};

export type State = {
  leftInventory: Inventory;
  rightInventory: Inventory;
  backpackInventory: Inventory;
  itemAmount: number;
  shiftPressed: boolean;
  isBusy: boolean;
  additionalMetadata: Array<{ metadata: string; value: string }>;
  history?: {
    leftInventory: Inventory;
    rightInventory: Inventory;
    backpackInventory: Inventory;
  };
  dragRotated: boolean;
  hotbar: (number | null)[];
  craftQueue: CraftQueueItem[];
  craftQueueProcessing: boolean;
  searchState: SearchState;
};
