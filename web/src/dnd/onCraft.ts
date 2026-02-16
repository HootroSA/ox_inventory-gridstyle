import { store } from '../store';
import { DragSource, DropTarget } from '../typings';
import { isSlotWithItem } from '../helpers';
import { isGridInventory } from '../helpers/gridUtils';
import { Items } from '../store/items';
import { craftItem } from '../thunks/craftItem';

export const onCraft = (source: DragSource, target: DropTarget) => {
  const { inventory: state } = store.getState();

  const sourceInventory = state.rightInventory;
  const targetInventory = state.leftInventory;

  const sourceSlot = sourceInventory.items[source.item.slot - 1];

  if (!isSlotWithItem(sourceSlot)) throw new Error(`Item ${sourceSlot.slot} name === undefined`);

  if (sourceSlot.count === 0) return;

  const sourceData = Items[sourceSlot.name];

  if (sourceData === undefined) return console.error(`Item ${sourceSlot.name} data undefined!`);

  const count = state.itemAmount === 0 ? 1 : state.itemAmount;

  let toSlot: number;
  if (isGridInventory(targetInventory.type)) {
    let maxSlot = 0;
    for (const i of targetInventory.items) if (typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
    toSlot = maxSlot + 1;
  } else {
    const targetSlotData = targetInventory.items[target.item.slot - 1];
    if (targetSlotData === undefined) return console.error(`Target slot undefined`);
    toSlot = targetSlotData.slot;
  }

  store.dispatch(
    craftItem({
      fromSlot: sourceSlot.slot,
      toSlot,
      fromType: sourceInventory.type,
      toType: targetInventory.type,
      count,
    })
  );
};
