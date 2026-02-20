import { isSlotWithItem } from '../helpers';
import { isGridInventory } from '../helpers/gridUtils';
import { store } from '../store';
import { DragSource, DropTarget } from '../typings';
import { Items } from '../store/items';
import { buyItem } from '../thunks/buyItem';

export const onBuy = (source: DragSource, target: DropTarget) => {
  const { inventory: state } = store.getState();

  const sourceInventory = state.rightInventory;
  const targetInventory = state.leftInventory;

  const sourceSlot = sourceInventory.items[source.item.slot - 1];

  if (!sourceSlot || !isSlotWithItem(sourceSlot)) throw new Error(`Item ${source.item.slot} name === undefined`);

  if (sourceSlot.count === 0) return;

  const sourceData = Items[sourceSlot.name];

  if (sourceData === undefined) return console.error(`Item ${sourceSlot.name} data undefined!`);

  const count =
    state.itemAmount !== 0
      ? sourceSlot.count
        ? state.itemAmount > sourceSlot.count
          ? sourceSlot.count
          : state.itemAmount
        : state.itemAmount
      : 1;

  let toSlot: number;
  if (isGridInventory(targetInventory.type)) {
    let maxSlot = 0;
    for (const i of targetInventory.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
    for (const i of sourceInventory.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
    toSlot = maxSlot + 1;
  } else {
    const targetSlotData = targetInventory.items[target.item.slot - 1];
    if (targetSlotData === undefined) return console.error(`Target slot undefined`);
    toSlot = targetSlotData.slot;
  }

  store.dispatch(
    buyItem({
      fromSlot: sourceSlot.slot,
      toSlot,
      fromType: sourceInventory.type,
      toType: targetInventory.type,
      count,
    })
  );
};
