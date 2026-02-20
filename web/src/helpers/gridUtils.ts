import { GridPosition, ItemSize } from '../typings/grid';
import { Slot, SlotWithItem } from '../typings/slot';
import { ItemData } from '../typings/item';
import { Items } from '../store/items';
import { COMPONENT_SIZE_MODIFIERS } from './gridConstants';

export type OccupancyGrid = (number | null)[][];

export function getEffectiveDimensions(
  size: ItemSize,
  rotated: boolean
): { width: number; height: number } {
  return rotated ? { width: size.height, height: size.width } : { width: size.width, height: size.height };
}

export function getItemSize(itemName: string, itemSizes: Record<string, ItemSize | undefined>): ItemSize {
  return itemSizes[itemName] ?? { width: 1, height: 1 };
}

export function getWeaponEffectiveSize(
  itemName: string,
  metadata?: { components?: string[]; [key: string]: any },
  itemSizes?: Record<string, ItemSize | undefined>
): ItemSize {
  const base = Items[itemName];
  let width = base?.width ?? itemSizes?.[itemName]?.width ?? 1;
  let height = base?.height ?? itemSizes?.[itemName]?.height ?? 1;
  if (!base?.weapon || !metadata?.components) return { width, height };
  for (const comp of metadata.components) {
    const compData = Items[comp];
    if (compData?.sizeModifier) {
      width += compData.sizeModifier[0];
      height += compData.sizeModifier[1];
    } else if (compData?.type) {
      const mod = COMPONENT_SIZE_MODIFIERS[compData.type] ?? { width: 0, height: 0 };
      width += mod.width;
      height += mod.height;
    }
  }
  return { width, height };
}

export function getSlotEffectiveSize(slot: Slot, itemSizes: Record<string, ItemSize | undefined>): ItemSize {
  if (slot.name && Items[slot.name]?.weapon && slot.metadata?.components?.length) {
    return getWeaponEffectiveSize(slot.name, slot.metadata, itemSizes);
  }
  return getItemSize(slot.name ?? '', itemSizes);
}

export function buildOccupancyGrid(
  gridWidth: number,
  gridHeight: number,
  items: Slot[],
  itemSizes: Record<string, ItemSize | undefined>,
  excludeSlot?: number
): OccupancyGrid {
  const grid: OccupancyGrid = [];

  for (let y = 0; y < gridHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      grid[y][x] = null;
    }
  }

  for (const item of items) {
    if (!item || !item.name || item.gridX === undefined || item.gridY === undefined) continue;
    if (excludeSlot !== undefined && item.slot === excludeSlot) continue;

    const size = getSlotEffectiveSize(item, itemSizes);
    const { width, height } = getEffectiveDimensions(size, item.rotated ?? false);

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cx = item.gridX + dx;
        const cy = item.gridY + dy;
        if (cy >= 0 && cy < gridHeight && cx >= 0 && cx < gridWidth) {
          grid[cy][cx] = item.slot;
        }
      }
    }
  }

  return grid;
}

export function canPlaceItem(
  occupancy: OccupancyGrid,
  gridWidth: number,
  gridHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  if (x < 0 || y < 0 || x + width > gridWidth || y + height > gridHeight) {
    return false;
  }

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (occupancy[y + dy][x + dx] !== null) {
        return false;
      }
    }
  }

  return true;
}

export function findFirstFit(
  occupancy: OccupancyGrid,
  gridWidth: number,
  gridHeight: number,
  width: number,
  height: number
): { x: number; y: number; rotated: boolean } | null {
  for (let y = 0; y <= gridHeight - height; y++) {
    for (let x = 0; x <= gridWidth - width; x++) {
      if (canPlaceItem(occupancy, gridWidth, gridHeight, x, y, width, height)) {
        return { x, y, rotated: false };
      }
    }
  }

  if (width !== height) {
    for (let y = 0; y <= gridHeight - width; y++) {
      for (let x = 0; x <= gridWidth - height; x++) {
        if (canPlaceItem(occupancy, gridWidth, gridHeight, x, y, height, width)) {
          return { x, y, rotated: true };
        }
      }
    }
  }

  return null;
}

export function getOccupiedCells(
  x: number,
  y: number,
  width: number,
  height: number
): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      cells.push({ gridX: x + dx, gridY: y + dy });
    }
  }
  return cells;
}

export function pixelToGrid(
  pixelX: number,
  pixelY: number,
  cellSize: number,
  gridGap: number = 0
): GridPosition {
  const effectiveCellSize = cellSize + gridGap;
  return {
    gridX: Math.floor(pixelX / effectiveCellSize),
    gridY: Math.floor(pixelY / effectiveCellSize),
  };
}

export function clampGridPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  gridWidth: number,
  gridHeight: number
): GridPosition {
  return {
    gridX: Math.max(0, Math.min(x, gridWidth - width)),
    gridY: Math.max(0, Math.min(y, gridHeight - height)),
  };
}

export function getSlotAtCell(
  occupancy: OccupancyGrid,
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): number | null {
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return null;
  return occupancy[y][x];
}

export type SwapResult = false | { rotateTarget: boolean };

export function canSwapItems(
  gridWidth: number,
  gridHeight: number,
  items: Slot[],
  itemSizes: Record<string, ItemSize | undefined>,
  slotA: SlotWithItem,
  slotB: SlotWithItem,
  overrideRotationA?: boolean
): SwapResult {
  const sizeA = getSlotEffectiveSize(slotA, itemSizes);
  const sizeB = getSlotEffectiveSize(slotB, itemSizes);
  const dimA = getEffectiveDimensions(sizeA, overrideRotationA ?? (slotA.rotated ?? false));

  if (sizeA.width * sizeA.height !== sizeB.width * sizeB.height) return false;

  if (slotA.gridX === undefined || slotA.gridY === undefined ||
      slotB.gridX === undefined || slotB.gridY === undefined) {
    return false;
  }

  const gridWithout = buildOccupancyGrid(gridWidth, gridHeight, items, itemSizes, slotA.slot);
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (gridWithout[y][x] === slotB.slot) {
        gridWithout[y][x] = null;
      }
    }
  }

  const aFitsAtB = canPlaceItem(gridWithout, gridWidth, gridHeight, slotB.gridX, slotB.gridY, dimA.width, dimA.height);
  if (!aFitsAtB) return false;

  const bRotCurrent = slotB.rotated ?? false;
  const orientations: [boolean, boolean][] = [
    [bRotCurrent, false],
    [!bRotCurrent, true],
  ];

  for (const [bRot, rotateTarget] of orientations) {
    const dimB = getEffectiveDimensions(sizeB, bRot);
    const bFitsAtA = canPlaceItem(gridWithout, gridWidth, gridHeight, slotA.gridX, slotA.gridY, dimB.width, dimB.height);
    if (!bFitsAtA) continue;

    const overlaps =
      slotB.gridX < slotA.gridX + dimB.width && slotB.gridX + dimA.width > slotA.gridX &&
      slotB.gridY < slotA.gridY + dimB.height && slotB.gridY + dimA.height > slotA.gridY;

    if (!overlaps) return { rotateTarget };
  }

  return false;
}

export function canSwapItemsCross(
  sourceGridWidth: number,
  sourceGridHeight: number,
  sourceItems: Slot[],
  targetGridWidth: number,
  targetGridHeight: number,
  targetItems: Slot[],
  itemSizes: Record<string, ItemSize | undefined>,
  draggedItem: SlotWithItem,
  targetItem: SlotWithItem,
  dragRotated: boolean
): SwapResult {
  const sizeA = getSlotEffectiveSize(draggedItem, itemSizes);
  const sizeB = getSlotEffectiveSize(targetItem, itemSizes);
  const dimA = getEffectiveDimensions(sizeA, dragRotated);

  if (sizeA.width * sizeA.height !== sizeB.width * sizeB.height) return false;

  if (draggedItem.gridX === undefined || draggedItem.gridY === undefined ||
      targetItem.gridX === undefined || targetItem.gridY === undefined) {
    return false;
  }

  const targetOccupancy = buildOccupancyGrid(targetGridWidth, targetGridHeight, targetItems, itemSizes, targetItem.slot);
  const aFitsAtB = canPlaceItem(targetOccupancy, targetGridWidth, targetGridHeight, targetItem.gridX, targetItem.gridY, dimA.width, dimA.height);
  if (!aFitsAtB) return false;

  const sourceOccupancy = buildOccupancyGrid(sourceGridWidth, sourceGridHeight, sourceItems, itemSizes, draggedItem.slot);
  const bRotCurrent = targetItem.rotated ?? false;
  const orientations: [boolean, boolean][] = [
    [bRotCurrent, false],
    [!bRotCurrent, true],
  ];

  for (const [bRot, rotateTarget] of orientations) {
    const dimB = getEffectiveDimensions(sizeB, bRot);
    const bFitsAtA = canPlaceItem(sourceOccupancy, sourceGridWidth, sourceGridHeight, draggedItem.gridX, draggedItem.gridY, dimB.width, dimB.height);
    if (bFitsAtA) return { rotateTarget };
  }

  return false;
}

export function isGridInventory(type: string): boolean {
  return true;
}
