import { Inventory } from './inventory';
import { Slot, SlotWithItem } from './slot';

export type DragSource = {
  item: Pick<SlotWithItem, 'slot' | 'name'>;
  inventory: Inventory['type'];
  inventoryId?: string;
  image?: string;
  width?: number;
  height?: number;
  splitCount?: number;
};

export type DropTarget = {
  item: Pick<Slot, 'slot'>;
  inventory: Inventory['type'];
  gridX?: number;
  gridY?: number;
};
