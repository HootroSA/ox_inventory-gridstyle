import React, { useCallback, useMemo, useRef } from 'react';
import { useDrop, DropTargetMonitor } from 'react-dnd';
import { Inventory, InventoryType, SlotWithItem } from '../../typings';
import { DragSource } from '../../typings/dnd';
import GridCell from './GridCell';
import GridItem from './GridItem';
import GridGhostOverlay from './GridGhostOverlay';
import { getTotalWeight, isSlotWithItem, canStack } from '../../helpers';
import { useAppSelector, useAppDispatch } from '../../store';
import { store } from '../../store';
import {
  selectDragRotated,
  selectItemAmount,
  setItemAmount,
  gridMoveSlots,
  gridSwapSlots,
  gridStackSlots,
  setDragRotated,
  closeBackpack,
  removeCraftQueueItem,
  updateCraftQueueItem,
  attachComponentToWeapon,
} from '../../store/inventory';
import { fetchNui } from '../../utils/fetchNui';
import { Items } from '../../store/items';
import { getItemSizes } from '../../helpers/itemSizeCache';
import {
  buildOccupancyGrid,
  canPlaceItem,
  canSwapItems,
  canSwapItemsCross,
  findFirstFit,
  getEffectiveDimensions,
  getItemSize,
  getWeaponEffectiveSize,
  SwapResult,
} from '../../helpers/gridUtils';
import { DEFAULT_GRID_DIMENSIONS } from '../../helpers/gridConstants';
import { getCellSizePx } from '../../helpers/uiScale';
import { clearSplit } from '../../store/contextMenu';
import { validateMove } from '../../thunks/validateItems';
import { buyItem } from '../../thunks/buyItem';
import { batchCollectCraftItems } from '../../thunks/craftQueue';
import { craftItem } from '../../thunks/craftItem';
import { getTypeIcon } from '../../helpers/getTypeIcon';

function pixelToGridCell(
  clientX: number,
  clientY: number,
  container: HTMLDivElement,
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } | null {
  const rect = container.getBoundingClientRect();

  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }

  const style = getComputedStyle(container);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;

  const relX = clientX - rect.left - paddingLeft;
  const relY = clientY - rect.top - paddingTop + container.scrollTop;

  if (relX < 0 || relY < 0) return null;

  const cellSize = getCellSizePx();
  const gap = 2;

  const cellX = Math.min(Math.floor(relX / (cellSize + gap)), gridWidth - 1);
  const cellY = Math.min(Math.floor(relY / (cellSize + gap)), gridHeight - 1);

  return { x: cellX, y: cellY };
}

interface GridInventoryProps {
  inventory: Inventory;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onClose?: () => void;
  canSort?: boolean;
}

const GridInventory: React.FC<GridInventoryProps> = ({ inventory, onHeaderMouseDown, isLocked, onToggleLock, onClose, canSort = true }) => {
  const dispatch = useAppDispatch();
  const dragRotated = useAppSelector(selectDragRotated);
  const isBusy = useAppSelector((state) => state.inventory.isBusy);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const isReadOnly = inventory.type === 'shop' || inventory.type === 'crafting';

  const sortCooldownRef = useRef(false);
  const handleSort = useCallback(() => {
    if (sortCooldownRef.current || isBusy) return;
    sortCooldownRef.current = true;
    fetchNui('sortInventory', { inventoryId: inventory.id });
    setTimeout(() => { sortCooldownRef.current = false; }, 500);
  }, [inventory.id, isBusy]);

  const gridWidth = inventory.gridWidth ?? DEFAULT_GRID_DIMENSIONS[inventory.type]?.gridWidth ?? 10;
  const gridHeight = inventory.gridHeight ?? DEFAULT_GRID_DIMENSIONS[inventory.type]?.gridHeight ?? 5;

  const weight = useMemo(
    () => (inventory.maxWeight !== undefined ? Math.floor(getTotalWeight(inventory.items) * 1000) / 1000 : 0),
    [inventory.maxWeight, inventory.items]
  );

  const itemsWithData = useMemo(
    () => inventory.items.filter((item): item is SlotWithItem => isSlotWithItem(item)),
    [inventory.items]
  );

  const itemSizes = useMemo(() => getItemSizes(), [itemsWithData]);

  const allCells = useMemo(() => {
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        cells.push({ x, y });
      }
    }
    return cells;
  }, [gridWidth, gridHeight]);

  const itemAmount = useAppSelector(selectItemAmount);

  const handleShopBuy = useCallback(
    (source: DragSource, gridX?: number, gridY?: number, rotated?: boolean, stackSlot?: number) => {
      const { inventory: reduxState } = store.getState();
      const shopInv = reduxState.rightInventory;
      const targetInv = inventory.type === 'backpack' ? reduxState.backpackInventory : reduxState.leftInventory;

      const sourceSlot = shopInv.items.find((i) => i != null && i.slot === source.item.slot);
      if (!sourceSlot || !isSlotWithItem(sourceSlot)) return;
      if (sourceSlot.count === 0) return;

      const count =
        itemAmount !== 0
          ? sourceSlot.count
            ? Math.min(itemAmount, sourceSlot.count)
            : itemAmount
          : 1;

      let toSlotNum: number;

      if (stackSlot !== undefined) {
        toSlotNum = stackSlot;
      } else {
        let maxSlot = 0;
        for (const i of targetInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
        for (const i of shopInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
        toSlotNum = maxSlot + 1;
      }

      dispatch(
        buyItem({
          fromSlot: sourceSlot.slot,
          toSlot: toSlotNum,
          fromType: shopInv.type,
          toType: targetInv.type,
          count,
          toGridX: gridX,
          toGridY: gridY,
          rotated,
        })
      );
    },
    [itemAmount, inventory, dispatch]
  );

  const handleCraftDrop = useCallback(
    (source: DragSource, gridX?: number, gridY?: number, rotated?: boolean, stackSlot?: number) => {
      const { inventory: reduxState } = store.getState();
      const craftInv = reduxState.rightInventory;
      const targetInv = inventory.type === 'backpack' ? reduxState.backpackInventory : reduxState.leftInventory;

      const sourceSlot = craftInv.items.find((i) => i != null && i.slot === source.item.slot);
      if (!sourceSlot || !isSlotWithItem(sourceSlot)) return;

      const count = itemAmount === 0 ? 1 : itemAmount;

      let toSlotNum: number;
      if (stackSlot !== undefined) {
        toSlotNum = stackSlot;
      } else {
        let maxSlot = 0;
        for (const i of targetInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
        toSlotNum = maxSlot + 1;
      }

      dispatch(
        craftItem({
          fromSlot: sourceSlot.slot,
          toSlot: toSlotNum,
          fromType: craftInv.type,
          toType: targetInv.type,
          count,
          toGridX: gridX,
          toGridY: gridY,
          rotated,
        })
      );
    },
    [itemAmount, inventory, dispatch]
  );

  const handleDrop = useCallback(
    (source: DragSource, monitor: DropTargetMonitor) => {
      const craftSource = source as any;
      if (craftSource.queueId && craftSource.pendingCraftIds) {
        const clientOffset = monitor.getClientOffset();
        let toGridX: number | undefined;
        let toGridY: number | undefined;
        let rotated: boolean | undefined;
        let stackSlot: number | undefined;

        if (clientOffset && gridContainerRef.current) {
          const itemName = craftSource.itemName as string;
          const size = getItemSize(itemName, itemSizes);
          const { width: effW, height: effH } = getEffectiveDimensions(size, dragRotated);
          const cell = pixelToGridCell(clientOffset.x, clientOffset.y, gridContainerRef.current, gridWidth, gridHeight);

          if (cell) {
            let ax = cell.x - Math.floor(effW / 2);
            let ay = cell.y - Math.floor(effH / 2);
            ax = Math.max(0, Math.min(ax, gridWidth - effW));
            ay = Math.max(0, Math.min(ay, gridHeight - effH));

            const occupancy = buildOccupancyGrid(gridWidth, gridHeight, inventory.items, itemSizes);
            if (canPlaceItem(occupancy, gridWidth, gridHeight, ax, ay, effW, effH)) {
              toGridX = ax;
              toGridY = ay;
              rotated = dragRotated;
            } else {
              const slotId = occupancy[ay]?.[ax];
              if (slotId !== null && slotId !== undefined) {
                const existing = inventory.items.find((i) => i != null && i.slot === slotId);
                const existingItemData = Items[itemName];
                if (existing && isSlotWithItem(existing) && existing.name === itemName && (existingItemData?.stack ?? existing.stack)) {
                  const shopMaxStack = existingItemData?.stackSize ?? existing.stackSize;
                  if (!shopMaxStack || existing.count < shopMaxStack) {
                    stackSlot = existing.slot;
                    toGridX = existing.gridX;
                    toGridY = existing.gridY;
                    rotated = existing.rotated;
                  }
                }
              }
              if (stackSlot === undefined) {
                const fit = findFirstFit(occupancy, gridWidth, gridHeight, size.width, size.height);
                if (fit) {
                  toGridX = fit.x;
                  toGridY = fit.y;
                  rotated = fit.rotated;
                }
              }
            }
          }
        }

        let maxSlot = 0;
        for (const i of inventory.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
        const toSlot = stackSlot ?? maxSlot + 1;

        dispatch(
          batchCollectCraftItems({
            queueId: craftSource.queueId,
            pendingCraftIds: craftSource.pendingCraftIds,
            toSlot,
            toGridX,
            toGridY,
            rotated,
            toType: inventory.type,
          }) as any
        ).then((result: any) => {
          if (batchCollectCraftItems.fulfilled.match(result)) {
            const { collectedCount, collectedIds } = result.payload;
            if (collectedCount >= craftSource.pendingCraftIds.length) {
              dispatch(removeCraftQueueItem(craftSource.queueId));
            } else if (collectedIds && collectedIds.length > 0) {
              dispatch(updateCraftQueueItem({
                queueId: craftSource.queueId,
                updates: {
                  pendingCraftIds: craftSource.pendingCraftIds.filter(
                    (id: string) => !collectedIds.includes(id)
                  ),
                  completedCount: craftSource.totalCount - (craftSource.pendingCraftIds.length - collectedIds.length),
                },
              }));
            }
          }
        });
        return;
      }

      if (source.inventory === InventoryType.SHOP || source.inventory === InventoryType.CRAFTING) {
        const offset = monitor.getClientOffset();
        let dropX: number | undefined;
        let dropY: number | undefined;
        let dropRotated: boolean | undefined;
        let stackSlot: number | undefined;

        if (offset && gridContainerRef.current) {
          const cell = pixelToGridCell(offset.x, offset.y, gridContainerRef.current, gridWidth, gridHeight);
          if (cell) {
            const size = getItemSize(source.item.name, itemSizes);
            const { width: effW, height: effH } = getEffectiveDimensions(size, dragRotated);
            let ax = cell.x - Math.floor(effW / 2);
            let ay = cell.y - Math.floor(effH / 2);
            ax = Math.max(0, Math.min(ax, gridWidth - effW));
            ay = Math.max(0, Math.min(ay, gridHeight - effH));

            const occupancy = buildOccupancyGrid(gridWidth, gridHeight, inventory.items, itemSizes);

            if (canPlaceItem(occupancy, gridWidth, gridHeight, ax, ay, effW, effH)) {
              dropX = ax;
              dropY = ay;
              dropRotated = dragRotated;
            } else {
              const slotId = occupancy[ay]?.[ax];
              if (slotId !== null && slotId !== undefined) {
                const existing = inventory.items.find((i) => i != null && i.slot === slotId);
                if (existing && isSlotWithItem(existing) && existing.name === source.item.name && Items[source.item.name]?.stack) {
                  stackSlot = existing.slot;
                  dropX = existing.gridX;
                  dropY = existing.gridY;
                  dropRotated = existing.rotated;
                }
              }
            }
          }
        }

        if (source.inventory === InventoryType.SHOP) {
          handleShopBuy(source, dropX, dropY, dropRotated, stackSlot);
        } else {
          handleCraftDrop(source, dropX, dropY, dropRotated, stackSlot);
        }
        return;
      }

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset || !gridContainerRef.current) return;

      const cell = pixelToGridCell(clientOffset.x, clientOffset.y, gridContainerRef.current, gridWidth, gridHeight);
      if (!cell) return;

      const sourceSize = { width: source.width ?? 1, height: source.height ?? 1 };
      const { width: effW, height: effH } = getEffectiveDimensions(sourceSize, dragRotated);

      let anchorX = cell.x - Math.floor(effW / 2);
      let anchorY = cell.y - Math.floor(effH / 2);
      anchorX = Math.max(0, Math.min(anchorX, gridWidth - effW));
      anchorY = Math.max(0, Math.min(anchorY, gridHeight - effH));

      const isLocalMove = source.inventoryId === inventory.id;

      const { inventory: reduxState } = store.getState();
      const sourceInv =
        source.inventoryId === reduxState.leftInventory.id
          ? reduxState.leftInventory
          : source.inventoryId === reduxState.backpackInventory.id
          ? reduxState.backpackInventory
          : reduxState.rightInventory;
      const sourceItem = sourceInv.items.find((i) => i != null && i.slot === source.item.slot);
      if (!sourceItem || !isSlotWithItem(sourceItem)) return;

      const sourceType = sourceInv.type;
      const targetType = inventory.type;

      const meta = (sourceItem as SlotWithItem).metadata;
      if (targetType === 'backpack' && meta?.container) return;
      if (targetType === 'container' && meta?.isBackpack) return;

      if (sourceType === 'player' && targetType !== 'player' && meta?.isBackpack && reduxState.backpackInventory.id) {
        fetchNui('closeBackpack');
        dispatch(closeBackpack());
      }

      const draggedItemData = Items[sourceItem.name];
      if (draggedItemData?.component && draggedItemData.type) {
        const cursorOccupancy = buildOccupancyGrid(gridWidth, gridHeight, inventory.items, itemSizes);
        const cursorSlotId = cursorOccupancy[cell.y]?.[cell.x];
        if (cursorSlotId !== null && cursorSlotId !== undefined) {
          const weaponSlot = inventory.items.find((i) => i != null && i.slot === cursorSlotId);
          if (weaponSlot && isSlotWithItem(weaponSlot) && Items[weaponSlot.name]?.weapon) {
            if (weaponSlot.searched === false) return;
            if (draggedItemData.compatibleWeapons && !draggedItemData.compatibleWeapons.includes(weaponSlot.name)) return;

            const compType = draggedItemData.type;
            const existingComponents: string[] = weaponSlot.metadata?.components ?? [];
            const typeAlreadyAttached = existingComponents.some((c: string) => Items[c]?.type === compType);
            if (typeAlreadyAttached) return;

            const newComponents = [...existingComponents, sourceItem.name];
            const newSize = getWeaponEffectiveSize(weaponSlot.name, { ...weaponSlot.metadata, components: newComponents });
            const weaponRotated = weaponSlot.rotated ?? false;
            const { width: newEffW, height: newEffH } = getEffectiveDimensions(newSize, weaponRotated);
            const weaponX = weaponSlot.gridX ?? 0;
            const weaponY = weaponSlot.gridY ?? 0;
            const growOccupancy = buildOccupancyGrid(gridWidth, gridHeight, inventory.items, itemSizes, weaponSlot.slot);
            if (isLocalMove) {
              for (let gy = 0; gy < gridHeight; gy++) {
                for (let gx = 0; gx < gridWidth; gx++) {
                  if (growOccupancy[gy][gx] === sourceItem.slot) growOccupancy[gy][gx] = null;
                }
              }
            }
            if (!canPlaceItem(growOccupancy, gridWidth, gridHeight, weaponX, weaponY, newEffW, newEffH)) return;

            fetchNui('attachComponent', {
              componentSlot: sourceItem.slot,
              weaponSlot: weaponSlot.slot,
              componentName: sourceItem.name,
            });

            dispatch(attachComponentToWeapon({
              componentSlot: sourceItem.slot,
              weaponSlot: weaponSlot.slot,
              componentName: sourceItem.name,
              sourceInvId: sourceInv.id,
              targetInvId: inventory.id,
            }));
            return;
          }
        }
      }

      const shiftHalf = reduxState.shiftPressed && sourceItem.count > 1 ? Math.floor(sourceItem.count / 2) : null;
      const moveCount = source.splitCount ?? shiftHalf ?? sourceItem.count;
      const isSplit = moveCount < sourceItem.count;

      const excludeSlot = isLocalMove && !isSplit ? source.item.slot : undefined;
      const occupancy = buildOccupancyGrid(gridWidth, gridHeight, inventory.items, itemSizes, excludeSlot);

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

      if (outOfBounds) return;

      const cursorSlotId = occupancy[cell.y]?.[cell.x];
      if (cursorSlotId !== null && cursorSlotId !== undefined) {
        const cursorTarget = inventory.items.find((i) => i != null && i.slot === cursorSlotId);
        const itemData = Items[sourceItem.name];
        if (cursorTarget && isSlotWithItem(cursorTarget) && cursorTarget.searched !== false &&
            canStack(sourceItem, cursorTarget) && (itemData?.stack ?? cursorTarget.stack)) {
          let stackCount = moveCount;
          const maxStack = itemData?.stackSize ?? cursorTarget.stackSize;
          if (maxStack) {
            const remaining = maxStack - cursorTarget.count;
            if (remaining <= 0) return;
            stackCount = Math.min(stackCount, remaining);
          }
          dispatch(
            validateMove({
              fromSlot: sourceItem.slot,
              fromType: sourceType,
              toSlot: cursorTarget.slot,
              toType: targetType,
              count: stackCount,
              toGridX: cursorTarget.gridX ?? anchorX,
              toGridY: cursorTarget.gridY ?? anchorY,
              rotated: cursorTarget.rotated ?? false,
            }) as any
          );
          dispatch(
            gridStackSlots({
              fromSlot: sourceItem,
              fromType: sourceType,
              toSlot: cursorTarget,
              toType: targetType,
              count: stackCount,
            })
          );
          return;
        }
      }

      if (occupiedSlots.size === 0) {
        if (!canPlaceItem(occupancy, gridWidth, gridHeight, anchorX, anchorY, effW, effH)) {
          return;
        }

        const needsUniqueSlot = (isLocalMove && isSplit) || !isLocalMove;
        let toSlotNum: number;
        if (needsUniqueSlot) {
          let maxSlot = 0;
          for (const i of sourceInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
          for (const i of inventory.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
          toSlotNum = maxSlot + 1;
        } else {
          toSlotNum = sourceItem.slot;
        }

        dispatch(
          validateMove({
            fromSlot: sourceItem.slot,
            fromType: sourceType,
            toSlot: toSlotNum,
            toType: targetType,
            count: moveCount,
            toGridX: anchorX,
            toGridY: anchorY,
            rotated: dragRotated,
          }) as any
        );

        dispatch(
          gridMoveSlots({
            fromSlot: sourceItem,
            fromType: sourceType,
            toType: targetType,
            toSlotId: toSlotNum,
            count: moveCount,
            toGridX: anchorX,
            toGridY: anchorY,
            rotated: dragRotated,
          })
        );
      } else if (!hasEmptyCells && occupiedSlots.size === 1) {
        const targetSlotId = [...occupiedSlots][0];
        const targetItem = inventory.items.find((i) => i != null && i.slot === targetSlotId);
        if (!targetItem || !isSlotWithItem(targetItem)) return;
        if (targetItem.searched === false) return;

        if (!isSplit) {
          let swapResult: SwapResult = false;

          if (isLocalMove) {
            swapResult = canSwapItems(
              gridWidth, gridHeight, inventory.items, itemSizes,
              sourceItem, targetItem, dragRotated
            );
          } else {
            const srcGridW = sourceInv.gridWidth ?? DEFAULT_GRID_DIMENSIONS[sourceInv.type]?.gridWidth ?? 10;
            const srcGridH = sourceInv.gridHeight ?? DEFAULT_GRID_DIMENSIONS[sourceInv.type]?.gridHeight ?? 5;
            swapResult = canSwapItemsCross(
              srcGridW, srcGridH, sourceInv.items,
              gridWidth, gridHeight, inventory.items,
              itemSizes, sourceItem, targetItem, dragRotated
            );
          }

          if (swapResult) {
            const displacedRotated = swapResult.rotateTarget
              ? !(targetItem.rotated ?? false)
              : (targetItem.rotated ?? false);

            dispatch(
              validateMove({
                fromSlot: sourceItem.slot,
                fromType: sourceType,
                toSlot: targetItem.slot,
                toType: targetType,
                count: sourceItem.count,
                toGridX: targetItem.gridX ?? anchorX,
                toGridY: targetItem.gridY ?? anchorY,
                rotated: dragRotated,
                targetRotated: displacedRotated,
              }) as any
            );
            dispatch(
              gridSwapSlots({
                fromSlot: sourceItem,
                fromType: sourceType,
                toSlot: targetItem,
                toType: targetType,
                dragRotated: dragRotated,
                rotateTarget: swapResult.rotateTarget,
              })
            );
          }
        }
      }

      if (isSplit) dispatch(clearSplit());
      dispatch(setDragRotated(false));
    },
    [inventory, gridWidth, gridHeight, itemSizes, dragRotated, dispatch, handleShopBuy, handleCraftDrop]
  );

  const [, drop] = useDrop<DragSource, { handled: boolean }, {}>(
    () => ({
      accept: isReadOnly ? [] : ['GRID_ITEM', 'SLOT', 'CRAFT_DONE_ITEM'],
      drop: (source, monitor) => {
        if (monitor.didDrop()) return;
        handleDrop(source, monitor);
        return { handled: true };
      },
    }),
    [handleDrop, isReadOnly]
  );

  const setGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      gridContainerRef.current = node;
      drop(node);
    },
    [drop]
  );

  const itemCount = itemsWithData.length;
  const isPlayer = inventory.type === 'player';
  const isShop = inventory.type === 'shop';
  const isCrafting = inventory.type === 'crafting';

  const displayAmount = itemAmount === 0 ? 1 : itemAmount;

  const handleAmountDecrease = useCallback(() => {
    dispatch(setItemAmount(Math.max(1, displayAmount - 1)));
  }, [dispatch, displayAmount]);

  const handleAmountIncrease = useCallback(() => {
    dispatch(setItemAmount(displayAmount + 1));
  }, [dispatch, displayAmount]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      dispatch(setItemAmount(isNaN(val) || val < 1 ? 1 : val));
    },
    [dispatch]
  );

  const handleAmountQuick = useCallback(
    (amount: number) => {
      dispatch(setItemAmount(amount));
    },
    [dispatch]
  );

  const weightKg = (weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const maxWeightKg = inventory.maxWeight
    ? (inventory.maxWeight / 1000).toLocaleString('en-us', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
  const weightPercent = inventory.maxWeight ? (weight / inventory.maxWeight) * 100 : 0;

  return (
    <div className="inventory-grid-wrapper" data-inv-type={inventory.type} style={{ pointerEvents: isBusy ? 'none' : 'auto' }}>
      <div className={`inventory-grid-header-wrapper${isLocked ? ' header--locked' : ''}`} onMouseDown={onHeaderMouseDown}>
        <div className="grid-header-left">
          <div className="grid-header-icon-wrap">
            {getTypeIcon(inventory.type)}
          </div>
          <span className="grid-header-label">{inventory.label}</span>
        </div>
        <div className="grid-header-right">
          {isShop && (
            <div className="grid-header-badge grid-header-badge--shop">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </div>
          )}
          {isCrafting && (
            <div className="grid-header-badge grid-header-badge--crafting">
              {itemCount} {itemCount === 1 ? 'recipe' : 'recipes'}
            </div>
          )}
          {(isShop || isCrafting) && (
            <div className={`grid-amount-selector ${isShop ? 'grid-amount-selector--shop' : 'grid-amount-selector--craft'}`}>
              <span className="grid-amount-label">QTY</span>
              <button className="grid-amount-btn" onClick={handleAmountDecrease}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
              </button>
              <input
                className="grid-amount-input"
                type="number"
                min={1}
                value={displayAmount}
                onChange={handleAmountChange}
              />
              <button className="grid-amount-btn" onClick={handleAmountIncrease}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </button>
              <div className="grid-amount-presets">
                <button className={`grid-amount-quick ${displayAmount === 1 ? 'grid-amount-quick--active' : ''}`} onClick={() => handleAmountQuick(1)}>1</button>
                <button className={`grid-amount-quick ${displayAmount === 5 ? 'grid-amount-quick--active' : ''}`} onClick={() => handleAmountQuick(5)}>5</button>
                <button className={`grid-amount-quick ${displayAmount === 10 ? 'grid-amount-quick--active' : ''}`} onClick={() => handleAmountQuick(10)}>10</button>
              </div>
            </div>
          )}
          {inventory.maxWeight !== undefined && inventory.maxWeight > 0 && (
            <div className="grid-header-weight-group">
              <span className="grid-header-weight">{weightKg}</span>
              <span className="grid-header-weight-separator">/</span>
              <span className="grid-header-weight">{maxWeightKg} Kg</span>
              <div className={`grid-header-weight-bar${weightPercent >= 90 ? ' grid-header-weight-bar--critical' : ''}`}>
                <div
                  className="grid-header-weight-bar-fill"
                  style={{ width: `${Math.min(weightPercent, 100)}%` }}
                />
              </div>
            </div>
          )}
          {(canSort || onToggleLock || onClose) && <div className="grid-header-btn-separator" />}
          {canSort && !isReadOnly && (
            <button className="panel-sort-btn" onClick={handleSort} title="Auto-sort">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M3 12h14"/><path d="M3 18h10"/>
              </svg>
            </button>
          )}
          {onToggleLock && (
            <button className={`panel-lock-btn${isLocked ? ' panel-lock-btn--locked' : ''}`} onClick={onToggleLock} title={isLocked ? 'Unlock panel' : 'Lock panel'}>
              {isLocked ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              )}
            </button>
          )}
          {onClose && (
            <button className="panel-close-btn" onClick={onClose} title="Close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        ref={setGridRef}
        className="grid-inventory-container"
        style={{
          gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`,
          gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))`,
        }}
      >
        {allCells.map(({ x, y }) => (
          <GridCell key={`cell-${x}-${y}`} x={x} y={y} />
        ))}
        {!isReadOnly && (
          <GridGhostOverlay
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            inventoryItems={inventory.items}
            inventoryId={inventory.id}
            inventoryType={inventory.type}
            containerRef={gridContainerRef}
          />
        )}
        {itemsWithData.map((item) => (
          <GridItem
            key={`item-${item.slot}`}
            item={item}
            inventoryType={inventory.type}
            inventoryId={inventory.id}
            inventoryGroups={inventory.groups}
          />
        ))}
        {isBusy && (
          <div className="grid-busy-overlay">
            <div className="grid-busy-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(GridInventory);
