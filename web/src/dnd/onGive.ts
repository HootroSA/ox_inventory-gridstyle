import { store } from '../store';
import { Slot } from '../typings';
import { fetchNui } from '../utils/fetchNui';

export const onGive = (item: Slot) => {
  const {
    inventory: { itemAmount },
    contextMenu: { splitAmount },
  } = store.getState();
  const count = splitAmount ?? itemAmount;
  fetchNui('giveItem', { slot: item.slot, count });
};
