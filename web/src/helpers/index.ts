import { Inventory, InventoryType, ItemData, Slot, SlotWithItem, State } from '../typings';
import { isEqual } from 'lodash';
import { store } from '../store';
import { Items } from '../store/items';
import { imagepath } from '../store/imagepath';
import { fetchNui } from '../utils/fetchNui';

export const canPurchaseItem = (item: Slot, inventory: { type: Inventory['type']; groups: Inventory['groups'] }) => {
  if (inventory.type !== 'shop' || !isSlotWithItem(item)) return true;

  if (item.count !== undefined && item.count === 0) return false;

  if (item.grade === undefined || !inventory.groups) return true;

  const leftInventory = store.getState().inventory.leftInventory;

  if (!leftInventory.groups) return false;

  const reqGroups = Object.keys(inventory.groups);

  if (Array.isArray(item.grade)) {
    for (let i = 0; i < reqGroups.length; i++) {
      const reqGroup = reqGroups[i];

      if (leftInventory.groups[reqGroup] !== undefined) {
        const playerGrade = leftInventory.groups[reqGroup];
        for (let j = 0; j < item.grade.length; j++) {
          const reqGrade = item.grade[j];

          if (playerGrade === reqGrade) return true;
        }
      }
    }

    return false;
  } else {
    for (let i = 0; i < reqGroups.length; i++) {
      const reqGroup = reqGroups[i];
      if (leftInventory.groups[reqGroup] !== undefined) {
        const playerGrade = leftInventory.groups[reqGroup];

        if (playerGrade >= item.grade) return true;
      }
    }

    return false;
  }
};

export const canCraftItem = (item: Slot, inventoryType: string) => {
  if (!isSlotWithItem(item) || inventoryType !== 'crafting') return true;
  if (!item.ingredients) return true;
  const leftInventory = store.getState().inventory.leftInventory;
  const ingredientItems = Object.entries(item.ingredients);

  const remainingItems = ingredientItems.filter((ingredient) => {
    const [item, count] = [ingredient[0], ingredient[1]];
    const globalItem = Items[item];

    if (count >= 1) {
      if (globalItem && globalItem.count >= count) return false;
    }

    const hasItem = leftInventory.items.find((playerItem) => {
      if (isSlotWithItem(playerItem) && playerItem.name === item) {
        if (count < 1) {
          if (playerItem.metadata?.durability >= count * 100) return true;

          return false;
        }
      }
    });

    return !hasItem;
  });

  return remainingItems.length === 0;
};

export const canCraftItemWithReservations = (
  item: Slot,
  inventoryType: string,
  reserved: Record<string, number>
): boolean => {
  if (!isSlotWithItem(item) || inventoryType !== 'crafting') return true;
  if (!item.ingredients) return true;

  const leftInventory = store.getState().inventory.leftInventory;

  for (const [ingredientName, needed] of Object.entries(item.ingredients)) {
    if (needed < 1) continue;

    const alreadyReserved = reserved[ingredientName] || 0;
    const totalNeeded = alreadyReserved + needed;

    let available = 0;
    for (const slot of leftInventory.items) {
      if (isSlotWithItem(slot) && slot.name === ingredientName) {
        available += slot.count;
      }
    }

    if (available < totalNeeded) return false;
  }

  for (const [ingredientName, needed] of Object.entries(item.ingredients)) {
    if (needed < 1) continue;
    reserved[ingredientName] = (reserved[ingredientName] || 0) + needed;
  }

  return true;
};

export const isSlotWithItem = (slot: Slot, strict: boolean = false): slot is SlotWithItem =>
  slot != null &&
  ((slot.name !== undefined && slot.weight !== undefined) ||
  (strict && slot.name !== undefined && slot.count !== undefined && slot.weight !== undefined));

export const canStack = (sourceSlot: Slot, targetSlot: Slot) =>
  sourceSlot.name === targetSlot.name && isEqual(sourceSlot.metadata, targetSlot.metadata);

export const findAvailableSlot = (item: Slot, data: ItemData, items: Slot[]) => {
  if (!data.stack) return items.find((target) => target.name === undefined);

  const stackableSlot = items.find((target) => {
    if (target.name !== item.name || !isEqual(target.metadata, item.metadata)) return false;
    if (data.stackSize && (target.count ?? 0) >= data.stackSize) return false;
    return true;
  });

  return stackableSlot || items.find((target) => target.name === undefined);
};

export const getTargetInventory = (
  state: State,
  sourceType: Inventory['type'],
  targetType?: Inventory['type']
): { sourceInventory: Inventory; targetInventory: Inventory } => {
  const resolve = (type: Inventory['type']) => {
    if (type === InventoryType.PLAYER) return state.leftInventory;
    if (type === InventoryType.BACKPACK) return state.backpackInventory;
    return state.rightInventory;
  };

  return {
    sourceInventory: resolve(sourceType),
    targetInventory: targetType
      ? resolve(targetType)
      : sourceType === InventoryType.PLAYER
        ? state.rightInventory
        : state.leftInventory,
  };
};

export const itemDurability = (metadata: any, curTime: number) => {
  // sorry dunak
  // it's ok linden i fix inventory
  if (metadata?.durability === undefined) return;

  let durability = metadata.durability;

  if (durability > 100 && metadata.degrade)
    durability = ((metadata.durability - curTime) / (60 * metadata.degrade)) * 100;

  if (durability < 0) durability = 0;

  return durability;
};

export const getTotalWeight = (items: Inventory['items']) =>
  items.reduce((totalWeight, slot) => (isSlotWithItem(slot) ? totalWeight + slot.weight : totalWeight), 0);

export const isContainer = (inventory: Inventory) => inventory.type === InventoryType.CONTAINER;

export const getItemData = async (itemName: string) => {
  const resp: ItemData | null = await fetchNui('getItemData', itemName);

  if (resp?.name) {
    Items[itemName] = resp;
    return resp;
  }
};

export const getItemUrl = (item: string | SlotWithItem) => {
  const isObj = typeof item === 'object';

  if (isObj) {
    if (!item.name) return;

    const metadata = item.metadata;

    // @todo validate urls and support webp
    if (metadata?.imageurl) return `${metadata.imageurl}`;
    if (metadata?.image) return `${imagepath}/${metadata.image}.png`;
  }

  const itemName = isObj ? (item.name as string) : item;
  const itemData = Items[itemName];

  if (!itemData) return `${imagepath}/${itemName}.png`;
  if (itemData.image) return itemData.image;

  itemData.image = `${imagepath}/${itemName}.png`;

  return itemData.image;
};
