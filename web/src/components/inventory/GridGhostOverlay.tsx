import React, { useMemo, useRef } from 'react';
import { SlotWithItem } from '../../typings';
import { useAppSelector } from '../../store';
import { selectDragRotated } from '../../store/inventory';
import { Items } from '../../store/items';
import { isSlotWithItem } from '../../helpers';
import {
  buildOccupancyGrid,
  canPlaceItem,
  canSwapItems,
  canSwapItemsCross,
  getEffectiveDimensions,
  getWeaponEffectiveSize,
} from '../../helpers/gridUtils';
import { DEFAULT_GRID_DIMENSIONS } from '../../helpers/gridConstants';
import { getCellSizePx } from '../../helpers/uiScale';
import { Inventory } from '../../typings';
import { useThrottledDragLayer } from '../../hooks/useThrottledDragLayer';
import { getItemSizes } from '../../helpers/itemSizeCache';

interface GridGhostOverlayProps {
  gridWidth: number;
  gridHeight: number;
  inventoryItems: Inventory['items'];
  inventoryId: string;
  inventoryType: Inventory['type'];
  containerRef: React.RefObject<HTMLDivElement>;
}

interface CachedLayout {
  rect: DOMRect;
  paddingLeft: number;
  paddingTop: number;
  cellSize: number;
  gap: number;
  containerEl: HTMLDivElement;
}

let layoutCache: CachedLayout | null = null;
let layoutFrameId = 0;

function getCachedLayout(container: HTMLDivElement): CachedLayout {
  const frame = layoutFrameId;
  const currentFrame = performance.now();

  if (layoutCache && layoutCache.containerEl === container && currentFrame - frame < 16) {
    return layoutCache;
  }

  const rect = container.getBoundingClientRect();
  const style = getComputedStyle(container);
  layoutCache = {
    rect,
    paddingLeft: parseFloat(style.paddingLeft) || 0,
    paddingTop: parseFloat(style.paddingTop) || 0,
    cellSize: getCellSizePx(),
    gap: 2,
    containerEl: container,
  };
  layoutFrameId = currentFrame;
  return layoutCache;
}

function pixelToGridCell(
  clientX: number,
  clientY: number,
  container: HTMLDivElement,
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } | null {
  const layout = getCachedLayout(container);
  const { rect } = layout;

  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }

  const relX = clientX - rect.left - layout.paddingLeft;
  const relY = clientY - rect.top - layout.paddingTop + container.scrollTop;

  if (relX < 0 || relY < 0) return null;

  const step = layout.cellSize + layout.gap;
  const cellX = Math.min(Math.floor(relX / step), gridWidth - 1);
  const cellY = Math.min(Math.floor(relY / step), gridHeight - 1);

  return { x: cellX, y: cellY };
}

const GridGhostOverlay: React.FC<GridGhostOverlayProps> = ({
  gridWidth,
  gridHeight,
  inventoryItems,
  inventoryId,
  inventoryType,
  containerRef,
}) => {
  const dragRotated = useAppSelector(selectDragRotated);
  const leftInventory = useAppSelector((state) => state.inventory.leftInventory);
  const rightInventory = useAppSelector((state) => state.inventory.rightInventory);
  const backpackInventory = useAppSelector((state) => state.inventory.backpackInventory);

  const { data, isDragging, clientOffset } = useThrottledDragLayer();

  const itemSizes = useMemo(() => getItemSizes(), [inventoryItems]);

  const prevOccupancyRef = useRef<{
    key: string;
    grid: ReturnType<typeof buildOccupancyGrid>;
  } | null>(null);

  if (!isDragging || !data?.item) return null;

  const draggedItemData = Items[data.item.name];
  const isComponentDrag = !!(draggedItemData?.component && draggedItemData.type);
  const compType = isComponentDrag ? draggedItemData!.type! : '';
  const isLocalItem = data.inventoryId === inventoryId;

  const weaponHighlights: React.ReactElement[] = [];
  const draggedCompatible = isComponentDrag ? draggedItemData?.compatibleWeapons : undefined;
  if (isComponentDrag) {
    for (const invItem of inventoryItems) {
      if (!isSlotWithItem(invItem) || !Items[invItem.name]?.weapon) continue;

      if ((invItem as SlotWithItem).searched === false) continue;

      if (draggedCompatible && !draggedCompatible.includes(invItem.name)) continue;

      const existingComps = (invItem as SlotWithItem).metadata?.components ?? [];
      const typeAttached = existingComps.some((c: string) => Items[c]?.type === compType);
      if (typeAttached) continue;

      const wSize = getWeaponEffectiveSize(invItem.name, (invItem as SlotWithItem).metadata);
      const wRot = (invItem as SlotWithItem).rotated ?? false;
      const { width: wW, height: wH } = getEffectiveDimensions(wSize, wRot);
      const wX = (invItem as SlotWithItem).gridX ?? 0;
      const wY = (invItem as SlotWithItem).gridY ?? 0;

      weaponHighlights.push(
        <div
          key={`whl-${invItem.slot}`}
          className="grid-ghost-cell ghost-weapon-compat"
          style={{
            gridColumn: `${wX + 1} / span ${wW}`,
            gridRow: `${wY + 1} / span ${wH}`,
          }}
        />
      );
    }
  }

  if (!clientOffset || !containerRef.current) {
    return weaponHighlights.length > 0 ? <>{weaponHighlights}</> : null;
  }

  const cell = pixelToGridCell(clientOffset.x, clientOffset.y, containerRef.current, gridWidth, gridHeight);
  if (!cell) {
    return weaponHighlights.length > 0 ? <>{weaponHighlights}</> : null;
  }

  const size = { width: data.width ?? 1, height: data.height ?? 1 };
  const { width: effW, height: effH } = getEffectiveDimensions(size, dragRotated);
  let anchorX = cell.x - Math.floor(effW / 2);
  let anchorY = cell.y - Math.floor(effH / 2);

  anchorX = Math.max(0, Math.min(anchorX, gridWidth - effW));
  anchorY = Math.max(0, Math.min(anchorY, gridHeight - effH));

  const excludeSlot = isLocalItem ? data.item.slot : undefined;

  const cacheKey = `${inventoryId}:${excludeSlot ?? ''}:${inventoryItems.length}`;
  let occupancy: ReturnType<typeof buildOccupancyGrid>;
  if (prevOccupancyRef.current?.key === cacheKey) {
    occupancy = prevOccupancyRef.current.grid;
  } else {
    occupancy = buildOccupancyGrid(gridWidth, gridHeight, inventoryItems, itemSizes, excludeSlot);
    prevOccupancyRef.current = { key: cacheKey, grid: occupancy };
  }

  if (isComponentDrag) {
    const cursorSlotId = occupancy[cell.y]?.[cell.x];
    if (cursorSlotId !== null && cursorSlotId !== undefined) {
      const weaponSlot = inventoryItems.find((i) => i != null && i.slot === cursorSlotId);
      if (
        weaponSlot && isSlotWithItem(weaponSlot) && Items[weaponSlot.name]?.weapon &&
        (weaponSlot as SlotWithItem).searched !== false &&
        !(draggedCompatible && !draggedCompatible.includes(weaponSlot.name))
      ) {
        const existingComponents: string[] = weaponSlot.metadata?.components ?? [];
        const typeAlreadyAttached = existingComponents.some((c: string) => Items[c]?.type === compType);

        const filteredHighlights = weaponHighlights.filter((el) => el.key !== `whl-${weaponSlot.slot}`);

        const curSize = getWeaponEffectiveSize(weaponSlot.name, weaponSlot.metadata);
        const weaponRotated = weaponSlot.rotated ?? false;
        const { width: curEffW, height: curEffH } = getEffectiveDimensions(curSize, weaponRotated);
        const weaponX = weaponSlot.gridX ?? 0;
        const weaponY = weaponSlot.gridY ?? 0;

        if (typeAlreadyAttached) {
          return (
            <>
              {filteredHighlights}
              <div
                className="grid-ghost-cell ghost-weapon-incompat"
                style={{
                  gridColumn: `${weaponX + 1} / span ${curEffW}`,
                  gridRow: `${weaponY + 1} / span ${curEffH}`,
                }}
              />
            </>
          );
        }

        const newComponents = [...existingComponents, data.item.name];
        const newSize = getWeaponEffectiveSize(weaponSlot.name, { ...weaponSlot.metadata, components: newComponents });
        const { width: newEffW, height: newEffH } = getEffectiveDimensions(newSize, weaponRotated);

        const growOccupancy = buildOccupancyGrid(gridWidth, gridHeight, inventoryItems, itemSizes, weaponSlot.slot);
        if (isLocalItem) {
          for (let gy = 0; gy < gridHeight; gy++) {
            for (let gx = 0; gx < gridWidth; gx++) {
              if (growOccupancy[gy][gx] === data.item.slot) growOccupancy[gy][gx] = null;
            }
          }
        }
        const canGrow = canPlaceItem(growOccupancy, gridWidth, gridHeight, weaponX, weaponY, newEffW, newEffH);

        const outlineW = canGrow ? newEffW : curEffW;
        const outlineH = canGrow ? newEffH : curEffH;

        return (
          <>
            {filteredHighlights}
            <div
              className={`grid-ghost-cell ${canGrow ? 'ghost-attach' : 'ghost-weapon-incompat'}`}
              style={{
                gridColumn: `${weaponX + 1} / span ${outlineW}`,
                gridRow: `${weaponY + 1} / span ${outlineH}`,
              }}
            />
          </>
        );
      }
    }
  }

  const valid = canPlaceItem(occupancy, gridWidth, gridHeight, anchorX, anchorY, effW, effH);

  let nestingBlocked = false;
  if (inventoryType === 'backpack' || inventoryType === 'container') {
    const resolveSourceInv = () => {
      if (data.inventoryId === leftInventory.id) return leftInventory;
      if (data.inventoryId === backpackInventory.id) return backpackInventory;
      return rightInventory;
    };
    const srcInv = resolveSourceInv();
    const srcItem = srcInv.items.find((i) => i != null && i.slot === data.item.slot);
    if (srcItem && isSlotWithItem(srcItem)) {
      const meta = (srcItem as SlotWithItem).metadata;
      if (inventoryType === 'backpack' && meta?.container) nestingBlocked = true;
      if (inventoryType === 'container' && meta?.isBackpack) nestingBlocked = true;
    }
  }

  let showAsValid = nestingBlocked ? false : valid;
  if (!valid && !nestingBlocked) {
    const occupiedSlots = new Set<number>();
    let hasEmptyCells = false;
    let outOfBounds = false;
    for (let dy = 0; dy < effH; dy++) {
      for (let dx = 0; dx < effW; dx++) {
        const gx = anchorX + dx;
        const gy = anchorY + dy;
        if (gx >= gridWidth || gy >= gridHeight) { outOfBounds = true; break; }
        const slotId = occupancy[gy]?.[gx];
        if (slotId !== null && slotId !== undefined) {
          occupiedSlots.add(slotId);
        } else {
          hasEmptyCells = true;
        }
      }
      if (outOfBounds) break;
    }

    if (!outOfBounds && !hasEmptyCells && occupiedSlots.size === 1) {
      const targetSlotId = [...occupiedSlots][0];
      const targetItem = inventoryItems.find((i) => i != null && i.slot === targetSlotId);

      if (targetItem && isSlotWithItem(targetItem)) {
        const itemData = Items[data.item.name];
        const isStackable =
          data.item.name === targetItem.name && !!(itemData?.stack ?? targetItem.stack);
        const maxStack = itemData?.stackSize ?? targetItem.stackSize;
        const stackFull = isStackable && maxStack
          ? targetItem.count >= maxStack
          : false;

        if (isStackable && !stackFull) {
          showAsValid = true;
        } else if (isStackable && stackFull) {
          showAsValid = false;
        } else if (isLocalItem) {
          const sourceItem = inventoryItems.find((i) => i != null && i.slot === data.item.slot);
          if (sourceItem && isSlotWithItem(sourceItem)) {
            showAsValid = !!canSwapItems(
              gridWidth, gridHeight, inventoryItems, itemSizes,
              sourceItem as SlotWithItem, targetItem as SlotWithItem,
              dragRotated
            );
          }
        } else {
          const sourceInv = data.inventoryId === leftInventory.id ? leftInventory : rightInventory;
          const sourceItem = sourceInv.items.find((i) => i != null && i.slot === data.item.slot);
          if (sourceItem && isSlotWithItem(sourceItem)) {
            const srcGridW = sourceInv.gridWidth ?? DEFAULT_GRID_DIMENSIONS[sourceInv.type]?.gridWidth ?? 10;
            const srcGridH = sourceInv.gridHeight ?? DEFAULT_GRID_DIMENSIONS[sourceInv.type]?.gridHeight ?? 5;
            showAsValid = !!canSwapItemsCross(
              srcGridW, srcGridH, sourceInv.items,
              gridWidth, gridHeight, inventoryItems,
              itemSizes,
              sourceItem as SlotWithItem, targetItem as SlotWithItem,
              dragRotated
            );
          }
        }
      }
    }
  }

  const ghostCells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < effH; dy++) {
    for (let dx = 0; dx < effW; dx++) {
      const gx = anchorX + dx;
      const gy = anchorY + dy;
      if (gx < gridWidth && gy < gridHeight) {
        ghostCells.push({ x: gx, y: gy });
      }
    }
  }

  return (
    <>
      {weaponHighlights}
      {ghostCells.map(({ x, y }) => (
        <div
          key={`ghost-${x}-${y}`}
          className={`grid-ghost-cell ${showAsValid ? 'ghost-valid' : 'ghost-invalid'}`}
          style={{
            gridColumn: x + 1,
            gridRow: y + 1,
          }}
        />
      ))}
    </>
  );
};

export default React.memo(GridGhostOverlay);
