import { describe, it, expect } from 'vitest';
import {
  buildOccupancyGrid,
  canPlaceItem,
  findFirstFit,
  getEffectiveDimensions,
  getOccupiedCells,
  pixelToGrid,
  clampGridPosition,
  getSlotAtCell,
  canSwapItems,
  isGridInventory,
  getItemSize,
} from '../gridUtils';
import { ItemSize } from '../../typings/grid';
import { Slot, SlotWithItem } from '../../typings/slot';

const itemSizes: Record<string, ItemSize | undefined> = {
  water: { width: 1, height: 1 },
  bandage: { width: 1, height: 2 },
  pistol: { width: 3, height: 1 },
  rifle: { width: 5, height: 2 },
  phone: { width: 1, height: 1 },
  backpack: { width: 2, height: 2 },
};

function makeItem(slot: number, name: string, gridX: number, gridY: number, rotated = false): SlotWithItem {
  return { slot, name, gridX, gridY, rotated, count: 1, weight: 100 };
}

describe('getEffectiveDimensions', () => {
  it('returns original dimensions when not rotated', () => {
    expect(getEffectiveDimensions({ width: 3, height: 1 }, false)).toEqual({ width: 3, height: 1 });
  });

  it('swaps dimensions when rotated', () => {
    expect(getEffectiveDimensions({ width: 3, height: 1 }, true)).toEqual({ width: 1, height: 3 });
  });

  it('returns same dimensions for square items regardless of rotation', () => {
    const normal = getEffectiveDimensions({ width: 2, height: 2 }, false);
    const rotated = getEffectiveDimensions({ width: 2, height: 2 }, true);
    expect(normal).toEqual(rotated);
  });
});

describe('getItemSize', () => {
  it('returns the registered size for known items', () => {
    expect(getItemSize('pistol', itemSizes)).toEqual({ width: 3, height: 1 });
  });

  it('defaults to 1x1 for unknown items', () => {
    expect(getItemSize('unknown_item', itemSizes)).toEqual({ width: 1, height: 1 });
  });
});

describe('buildOccupancyGrid', () => {
  it('creates an empty grid with no items', () => {
    const grid = buildOccupancyGrid(4, 3, [], itemSizes);
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(4);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 4; x++) {
        expect(grid[y][x]).toBeNull();
      }
    }
  });

  it('marks cells occupied by a 1x1 item', () => {
    const items = [makeItem(1, 'water', 2, 1)];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes);
    expect(grid[1][2]).toBe(1);
    expect(grid[0][0]).toBeNull();
  });

  it('marks cells occupied by a multi-cell item', () => {
    const items = [makeItem(1, 'pistol', 0, 0)];
    const grid = buildOccupancyGrid(5, 3, items, itemSizes);
    expect(grid[0][0]).toBe(1);
    expect(grid[0][1]).toBe(1);
    expect(grid[0][2]).toBe(1);
    expect(grid[0][3]).toBeNull();
  });

  it('handles rotated items', () => {
    const items = [makeItem(1, 'pistol', 0, 0, true)];
    const grid = buildOccupancyGrid(5, 5, items, itemSizes);
    expect(grid[0][0]).toBe(1);
    expect(grid[1][0]).toBe(1);
    expect(grid[2][0]).toBe(1);
    expect(grid[0][1]).toBeNull();
  });

  it('handles multiple items', () => {
    const items = [
      makeItem(1, 'water', 0, 0),
      makeItem(2, 'bandage', 1, 0),
    ];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes);
    expect(grid[0][0]).toBe(1);
    expect(grid[0][1]).toBe(2);
    expect(grid[1][1]).toBe(2);
    expect(grid[1][0]).toBeNull();
  });

  it('excludes a specified slot', () => {
    const items = [
      makeItem(1, 'water', 0, 0),
      makeItem(2, 'phone', 1, 0),
    ];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes, 1);
    expect(grid[0][0]).toBeNull();
    expect(grid[0][1]).toBe(2);
  });

  it('skips items without grid coordinates', () => {
    const items: Slot[] = [{ slot: 1, name: 'water', count: 1, weight: 100 }];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 4; x++) {
        expect(grid[y][x]).toBeNull();
      }
    }
  });

  it('skips items without a name', () => {
    const items: Slot[] = [{ slot: 1, gridX: 0, gridY: 0 }];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes);
    expect(grid[0][0]).toBeNull();
  });
});

describe('canPlaceItem', () => {
  it('allows placement in an empty grid', () => {
    const grid = buildOccupancyGrid(5, 5, [], itemSizes);
    expect(canPlaceItem(grid, 5, 5, 0, 0, 1, 1)).toBe(true);
    expect(canPlaceItem(grid, 5, 5, 0, 0, 3, 1)).toBe(true);
    expect(canPlaceItem(grid, 5, 5, 0, 0, 5, 5)).toBe(true);
  });

  it('rejects out-of-bounds placement', () => {
    const grid = buildOccupancyGrid(5, 5, [], itemSizes);
    expect(canPlaceItem(grid, 5, 5, 4, 0, 2, 1)).toBe(false);
    expect(canPlaceItem(grid, 5, 5, 0, 4, 1, 2)).toBe(false);
    expect(canPlaceItem(grid, 5, 5, -1, 0, 1, 1)).toBe(false);
    expect(canPlaceItem(grid, 5, 5, 0, -1, 1, 1)).toBe(false);
  });

  it('rejects placement on occupied cells', () => {
    const items = [makeItem(1, 'pistol', 1, 1)];
    const grid = buildOccupancyGrid(5, 5, items, itemSizes);
    expect(canPlaceItem(grid, 5, 5, 2, 1, 1, 1)).toBe(false);
    expect(canPlaceItem(grid, 5, 5, 0, 1, 2, 1)).toBe(false);
  });

  it('allows placement adjacent to occupied cells', () => {
    const items = [makeItem(1, 'pistol', 0, 0)];
    const grid = buildOccupancyGrid(5, 5, items, itemSizes);
    expect(canPlaceItem(grid, 5, 5, 3, 0, 1, 1)).toBe(true);
    expect(canPlaceItem(grid, 5, 5, 0, 1, 1, 1)).toBe(true);
  });

  it('handles large items at grid edges', () => {
    const grid = buildOccupancyGrid(12, 5, [], itemSizes);
    expect(canPlaceItem(grid, 12, 5, 7, 3, 5, 2)).toBe(true);
    expect(canPlaceItem(grid, 12, 5, 8, 3, 5, 2)).toBe(false);
    expect(canPlaceItem(grid, 12, 5, 7, 4, 5, 2)).toBe(false);
  });
});

describe('findFirstFit', () => {
  it('places at (0,0) in empty grid', () => {
    const grid = buildOccupancyGrid(12, 5, [], itemSizes);
    const result = findFirstFit(grid, 12, 5, 1, 1);
    expect(result).toEqual({ x: 0, y: 0, rotated: false });
  });

  it('finds space after occupied cells', () => {
    const items = [makeItem(1, 'pistol', 0, 0)]; 
    const grid = buildOccupancyGrid(12, 5, items, itemSizes);
    const result = findFirstFit(grid, 12, 5, 2, 1);
    expect(result).toEqual({ x: 3, y: 0, rotated: false });
  });

  it('wraps to next row when current row is full', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem(i + 1, 'water', i, 0));
    const grid = buildOccupancyGrid(5, 5, items, itemSizes);
    const result = findFirstFit(grid, 5, 5, 1, 1);
    expect(result).toEqual({ x: 0, y: 1, rotated: false });
  });

  it('tries rotated orientation when normal doesnt fit', () => {
    const grid = buildOccupancyGrid(3, 5, [], itemSizes);
    const result = findFirstFit(grid, 3, 5, 5, 2);
    expect(result).toEqual({ x: 0, y: 0, rotated: true });
  });

  it('returns null when no space available', () => {
    const items = [
      makeItem(1, 'water', 0, 0),
      makeItem(2, 'water', 1, 0),
      makeItem(3, 'water', 0, 1),
      makeItem(4, 'water', 1, 1),
    ];
    const grid = buildOccupancyGrid(2, 2, items, itemSizes);
    expect(findFirstFit(grid, 2, 2, 1, 1)).toBeNull();
  });

  it('returns null for item larger than grid', () => {
    const grid = buildOccupancyGrid(3, 3, [], itemSizes);
    expect(findFirstFit(grid, 3, 3, 4, 1)).toBeNull(); 
  });

  it('doesnt try rotation for square items', () => {
    const items = [makeItem(1, 'water', 0, 0)];
    const grid = buildOccupancyGrid(2, 2, items, itemSizes);
    expect(findFirstFit(grid, 2, 2, 2, 2)).toBeNull();
  });

  it('handles tight packing scenarios', () => {
    const items = [
      makeItem(1, 'pistol', 0, 0),
      makeItem(2, 'pistol', 0, 1),
    ];
    const grid = buildOccupancyGrid(4, 3, items, itemSizes);
    const result = findFirstFit(grid, 4, 3, 2, 1);
    expect(result).toEqual({ x: 0, y: 2, rotated: false });
  });
});

describe('getOccupiedCells', () => {
  it('returns single cell for 1x1 item', () => {
    expect(getOccupiedCells(2, 3, 1, 1)).toEqual([{ gridX: 2, gridY: 3 }]);
  });

  it('returns correct cells for multi-cell item', () => {
    const cells = getOccupiedCells(1, 0, 3, 2);
    expect(cells).toHaveLength(6);
    expect(cells).toContainEqual({ gridX: 1, gridY: 0 });
    expect(cells).toContainEqual({ gridX: 2, gridY: 0 });
    expect(cells).toContainEqual({ gridX: 3, gridY: 0 });
    expect(cells).toContainEqual({ gridX: 1, gridY: 1 });
    expect(cells).toContainEqual({ gridX: 2, gridY: 1 });
    expect(cells).toContainEqual({ gridX: 3, gridY: 1 });
  });
});

describe('pixelToGrid', () => {
  it('converts pixel coordinates to grid position', () => {
    expect(pixelToGrid(0, 0, 50, 1)).toEqual({ gridX: 0, gridY: 0 });
    expect(pixelToGrid(51, 0, 50, 1)).toEqual({ gridX: 1, gridY: 0 });
    expect(pixelToGrid(102, 51, 50, 1)).toEqual({ gridX: 2, gridY: 1 });
  });

  it('floors fractional positions', () => {
    expect(pixelToGrid(49, 49, 50, 0)).toEqual({ gridX: 0, gridY: 0 });
    expect(pixelToGrid(50, 50, 50, 0)).toEqual({ gridX: 1, gridY: 1 });
  });
});

describe('clampGridPosition', () => {
  it('clamps within bounds', () => {
    expect(clampGridPosition(10, 3, 3, 1, 12, 5)).toEqual({ gridX: 9, gridY: 3 });
    expect(clampGridPosition(-1, -1, 1, 1, 12, 5)).toEqual({ gridX: 0, gridY: 0 });
  });

  it('does not clamp when already within bounds', () => {
    expect(clampGridPosition(5, 2, 2, 2, 12, 5)).toEqual({ gridX: 5, gridY: 2 });
  });

  it('handles item exactly fitting at bottom-right', () => {
    expect(clampGridPosition(9, 3, 3, 2, 12, 5)).toEqual({ gridX: 9, gridY: 3 });
    expect(clampGridPosition(10, 4, 3, 2, 12, 5)).toEqual({ gridX: 9, gridY: 3 });
  });
});

describe('getSlotAtCell', () => {
  it('returns slot ID at occupied cell', () => {
    const items = [makeItem(42, 'pistol', 1, 1)];
    const grid = buildOccupancyGrid(5, 5, items, itemSizes);
    expect(getSlotAtCell(grid, 1, 1, 5, 5)).toBe(42);
    expect(getSlotAtCell(grid, 2, 1, 5, 5)).toBe(42);
    expect(getSlotAtCell(grid, 3, 1, 5, 5)).toBe(42);
  });

  it('returns null at empty cell', () => {
    const grid = buildOccupancyGrid(5, 5, [], itemSizes);
    expect(getSlotAtCell(grid, 0, 0, 5, 5)).toBeNull();
  });

  it('returns null for out-of-bounds coordinates', () => {
    const grid = buildOccupancyGrid(5, 5, [], itemSizes);
    expect(getSlotAtCell(grid, -1, 0, 5, 5)).toBeNull();
    expect(getSlotAtCell(grid, 5, 0, 5, 5)).toBeNull();
    expect(getSlotAtCell(grid, 0, 5, 5, 5)).toBeNull();
  });
});

describe('canSwapItems', () => {
  it('allows swap of same-sized items', () => {
    const itemA = makeItem(1, 'water', 0, 0);
    const itemB = makeItem(2, 'phone', 3, 3);
    const items = [itemA, itemB];
    expect(canSwapItems(5, 5, items, itemSizes, itemA, itemB)).toBe(true);
  });

  it('allows swap when items fit in each others positions', () => {
    const itemA = makeItem(1, 'pistol', 0, 0);
    const itemB = makeItem(2, 'backpack', 5, 0);
    const items = [itemA, itemB];
    expect(canSwapItems(8, 5, items, itemSizes, itemA, itemB)).toBe(true);
  });

  it('rejects swap when item doesnt fit at others position', () => {
    const itemA = makeItem(1, 'rifle', 0, 0);
    const itemB = makeItem(2, 'water', 4, 3);
    const items = [itemA, itemB];
    expect(canSwapItems(5, 5, items, itemSizes, itemA, itemB)).toBe(false);
  });

  it('considers other items when checking swap validity', () => {
    const pistol = makeItem(1, 'pistol', 0, 0);
    const water = makeItem(2, 'water', 4, 0);
    const blocker = makeItem(3, 'phone', 3, 0);
    const items = [pistol, water, blocker];
    expect(canSwapItems(5, 5, items, itemSizes, pistol, water)).toBe(false);
  });
});

describe('isGridInventory', () => {
  it('returns true for player, stash, trunk, container, drop', () => {
    expect(isGridInventory('player')).toBe(true);
    expect(isGridInventory('stash')).toBe(true);
    expect(isGridInventory('trunk')).toBe(true);
    expect(isGridInventory('glovebox')).toBe(true);
    expect(isGridInventory('container')).toBe(true);
    expect(isGridInventory('drop')).toBe(true);
  });

  it('returns false for shop and crafting', () => {
    expect(isGridInventory('shop')).toBe(false);
    expect(isGridInventory('crafting')).toBe(false);
  });
});
