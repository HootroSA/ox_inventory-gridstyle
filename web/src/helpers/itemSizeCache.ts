import { ItemSize } from '../typings/grid';
import { Items } from '../store/items';

let cachedSizes: Record<string, ItemSize | undefined> | null = null;
let cachedItemsRef: typeof Items | null = null;

export function getItemSizes(): Record<string, ItemSize | undefined> {
  if (cachedSizes && cachedItemsRef === Items) return cachedSizes;

  const sizes: Record<string, ItemSize | undefined> = {};
  for (const name in Items) {
    const data = Items[name];
    if (data) sizes[name] = { width: data.width ?? 1, height: data.height ?? 1 };
  }

  cachedSizes = sizes;
  cachedItemsRef = Items;
  return sizes;
}

export function invalidateItemSizeCache() {
  cachedSizes = null;
  cachedItemsRef = null;
}
