import { Slot } from '../typings';
import { isSlotWithItem } from './index';
import { fetchNui } from '../utils/fetchNui';

interface HotbarBinding {
  itemName: string;
  slotId: number;
}

type StoredHotbar = (HotbarBinding | null)[];
const EMPTY: StoredHotbar = [null, null, null, null, null];
let cachedBindings: StoredHotbar = [...EMPTY];

export function loadBindingsFromServer(bindings: any) {
  if (!bindings) return;

  if (Array.isArray(bindings) && bindings.length === 5) {
    cachedBindings = bindings;
    return;
  }

  if (typeof bindings === 'object' && !Array.isArray(bindings)) {
    const result: StoredHotbar = [null, null, null, null, null];
    for (const key in bindings) {
      const idx = parseInt(key);
      if (idx >= 0 && idx < 5 && bindings[key] && typeof bindings[key] === 'object') {
        result[idx] = bindings[key] as HotbarBinding;
      }
    }
    cachedBindings = result;
  }
}

export function saveBinding(hotbarSlot: number, item: Slot | null): void {
  if (item && isSlotWithItem(item)) {
    cachedBindings[hotbarSlot] = {
      itemName: item.name,
      slotId: item.slot,
    };
  } else {
    cachedBindings[hotbarSlot] = null;
  }
  fetchNui('saveHotbar', { json: JSON.stringify([...cachedBindings]) });
}

export function reconcileHotbar(items: Slot[] | Record<string, Slot>): (number | null)[] {
  const itemsArray = Array.isArray(items) ? items : Object.values(items);

  const seenSlots = new Set<number>();
  for (let i = cachedBindings.length - 1; i >= 0; i--) {
    const b = cachedBindings[i];
    if (b) {
      if (seenSlots.has(b.slotId)) {
        cachedBindings[i] = null;
      } else {
        seenSlots.add(b.slotId);
      }
    }
  }

  let dirty = false;
  const result = cachedBindings.map((binding, idx) => {
    if (!binding) return null;

    const match = itemsArray.find(
      (i) => i != null && i.slot === binding.slotId && isSlotWithItem(i) && i.name === binding.itemName
    );

    if (!match) {
      cachedBindings[idx] = null;
      dirty = true;
      return null;
    }

    return match.slot;
  }) as (number | null)[];

  if (dirty) {
    fetchNui('saveHotbar', { json: JSON.stringify([...cachedBindings]) });
  }

  return result;
}
