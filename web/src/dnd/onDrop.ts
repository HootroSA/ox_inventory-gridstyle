import { canStack, findAvailableSlot, getTargetInventory, isSlotWithItem } from '../helpers';
import { isGridInventory } from '../helpers/gridUtils';
import { validateMove } from '../thunks/validateItems';
import { store } from '../store';
import { DragSource, DropTarget, InventoryType, SlotWithItem } from '../typings';
import { moveSlots, stackSlots, swapSlots } from '../store/inventory';
import { Items } from '../store/items';

export const onDrop = (source: DragSource, target?: DropTarget) => {
  const { inventory: state } = store.getState();

  const { sourceInventory, targetInventory } = getTargetInventory(state, source.inventory, target?.inventory);
  const sourceSlot = (isGridInventory(sourceInventory.type)
    ? sourceInventory.items.find((i) => i != null && i.slot === source.item.slot)
    : sourceInventory.items[source.item.slot - 1]) as SlotWithItem;

  const sourceData = Items[sourceSlot.name];

  if (sourceData === undefined) return console.error(`${sourceSlot.name} item data undefined!`);
  if (sourceSlot.metadata?.container !== undefined) {
    if (targetInventory.type === InventoryType.CONTAINER)
      return console.log(`Cannot store container ${sourceSlot.name} inside another container`);
    if (state.rightInventory.id === sourceSlot.metadata.container)
      return console.log(`Cannot move container ${sourceSlot.name} when opened`);
  }

  const targetSlot = target
    ? (isGridInventory(targetInventory.type)
        ? targetInventory.items.find((i) => i != null && i.slot === target.item.slot)
        : targetInventory.items[target.item.slot - 1])
    : findAvailableSlot(sourceSlot, sourceData, targetInventory.items);

  if (targetSlot === undefined) return console.error('Target slot undefined!');

  if (targetSlot.metadata?.container !== undefined && state.rightInventory.id === targetSlot.metadata.container)
    return console.log(`Cannot swap item ${sourceSlot.name} with container ${targetSlot.name} when opened`);

  const count =
    state.shiftPressed && sourceSlot.count > 1 && sourceInventory.type !== 'shop'
      ? Math.floor(sourceSlot.count / 2)
      : state.itemAmount === 0 || state.itemAmount > sourceSlot.count
      ? sourceSlot.count
      : state.itemAmount;

  const data = {
    fromSlot: sourceSlot,
    toSlot: targetSlot,
    fromType: sourceInventory.type,
    toType: targetInventory.type,
    count: count,
  };

  store.dispatch(
    validateMove({
      ...data,
      fromSlot: sourceSlot.slot,
      toSlot: targetSlot.slot,
    })
  );

  if (isSlotWithItem(targetSlot, true)) {
    if (sourceData.stack && canStack(sourceSlot, targetSlot)) {
      let stackCount = count;
      const maxStack = sourceData.stackSize ?? (targetSlot as SlotWithItem).stackSize;
      if (maxStack) {
        const remaining = maxStack - (targetSlot as SlotWithItem).count;
        if (remaining <= 0) {
          store.dispatch(swapSlots({ ...data, toSlot: targetSlot }));
          return;
        }
        stackCount = Math.min(stackCount, remaining);
      }
      store.dispatch(stackSlots({ ...data, toSlot: targetSlot, count: stackCount }));
    } else {
      store.dispatch(swapSlots({ ...data, toSlot: targetSlot }));
    }
  } else {
    store.dispatch(moveSlots(data));
  }
};
