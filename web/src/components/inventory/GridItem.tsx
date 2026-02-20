import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { DragSource, Inventory, InventoryType, SlotWithItem } from '../../typings';
import { useAppDispatch, useAppSelector } from '../../store';
import { store } from '../../store';
import { setDragRotated, gridMoveSlots, assignHotbar, clearHotbar, selectPlayerItemCounts, beginItemSearch, finishItemSearch, removePlayerItem } from '../../store/inventory';
import { Items } from '../../store/items';
import { getItemUrl, isSlotWithItem, canPurchaseItem, canCraftItem } from '../../helpers';
import { getEffectiveDimensions, buildOccupancyGrid, findFirstFit, getItemSize, getSlotEffectiveSize, getWeaponEffectiveSize, isGridInventory } from '../../helpers/gridUtils';
import { closeTooltip, openTooltip } from '../../store/tooltip';
import { openContextMenu, clearSplit } from '../../store/contextMenu';
import { onUse } from '../../dnd/onUse';
import { onDrop } from '../../dnd/onDrop';
import { validateMove } from '../../thunks/validateItems';
import WeightBar from '../utils/WeightBar';
import { Locale } from '../../store/locale';
import { getItemSizes } from '../../helpers/itemSizeCache';
import { fetchNui } from '../../utils/fetchNui';
import { isEnvBrowser } from '../../utils/misc';
import { saveBinding } from '../../helpers/hotbarPersistence';

interface GridItemProps {
  item: SlotWithItem;
  inventoryType: Inventory['type'];
  inventoryId: string;
  inventoryGroups: Inventory['groups'];
}

const GridItem: React.FC<GridItemProps> = ({ item, inventoryType, inventoryId, inventoryGroups }) => {
  const dispatch = useAppDispatch();
  const timerRef = useRef<number | null>(null);
  const isHovered = useRef(false);
  const isSearching = useAppSelector((state) => state.inventory.searchState.searchingSlots.includes(item.slot));
  const isUnsearched = item.searched === false && !isSearching;
  const [wasRevealed, setWasRevealed] = React.useState(false);
  const hotbarIndex = useAppSelector((state) =>
    inventoryType === 'player' ? state.inventory.hotbar.indexOf(item.slot) : -1
  );
  const splitData = useAppSelector((state) => state.contextMenu);

  const activeSplit =
    splitData.item?.slot === item.slot &&
      splitData.splitAmount !== null &&
      splitData.splitAmount < item.count
      ? splitData.splitAmount
      : undefined;

  const prevSearchingRef = useRef(isSearching);
  useEffect(() => {
    if (prevSearchingRef.current && !isSearching && item.searched !== false) {
      setWasRevealed(true);
      const timer = setTimeout(() => setWasRevealed(false), 500);
      return () => clearTimeout(timer);
    }
    prevSearchingRef.current = isSearching;
  }, [isSearching, item.searched]);

  const startItemSearch = useCallback(async () => {
    if (item.searched !== false || isSearching) return;

    let duration: number;
    if (isEnvBrowser()) {
      duration = 1500;
    } else {
      const result = await fetchNui<{ duration: number } | false>('startItemSearch', {
        slot: item.slot,
        inventoryId: inventoryId,
      });
      if (!result || typeof result !== 'object' || !result.duration) return;
      duration = result.duration;
    }

    dispatch(beginItemSearch(item.slot));

    setTimeout(() => {
      dispatch(finishItemSearch(item.slot));
      if (!isEnvBrowser()) {
        fetchNui('itemSearchComplete', { slot: item.slot, inventoryId: inventoryId });
      }
    }, duration);
  }, [item.slot, item.searched, isSearching, inventoryId, dispatch]);

  useEffect(() => {
    if (inventoryType !== 'player') return;
    const handler = (e: KeyboardEvent) => {
      if (!isHovered.current) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        const hotbarSlot = num - 1;
        const currentSlotId = store.getState().inventory.hotbar[hotbarSlot];
        if (currentSlotId === item.slot) {
          dispatch(clearHotbar(hotbarSlot));
          saveBinding(hotbarSlot, null);
        } else {
          const hotbar = store.getState().inventory.hotbar;
          for (let i = 0; i < hotbar.length; i++) {
            if (hotbar[i] === item.slot && i !== hotbarSlot) {
              saveBinding(i, null);
            }
          }
          dispatch(assignHotbar({ hotbarSlot, itemSlot: item.slot }));
          saveBinding(hotbarSlot, item);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item.slot, inventoryType, dispatch]);

  const weaponSize = getWeaponEffectiveSize(item.name, item.metadata);
  const baseWidth = weaponSize.width;
  const baseHeight = weaponSize.height;
  const { width: effectiveW, height: effectiveH } = getEffectiveDimensions(
    weaponSize,
    item.rotated ?? false
  );

  const [{ isDragging }, drag] = useDrag<DragSource, void, { isDragging: boolean }>(
    () => ({
      type: 'GRID_ITEM',
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: () => {
        dispatch(setDragRotated(item.rotated ?? false));
        return {
          inventory: inventoryType,
          inventoryId: inventoryId,
          item: { name: item.name, slot: item.slot },
          image: `url(${getItemUrl(item) || 'none'}`,
          width: baseWidth,
          height: baseHeight,
          splitCount: activeSplit,
        };
      },
      canDrag: () =>
        !isUnsearched &&
        !isSearching &&
        canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) &&
        canCraftItem(item, inventoryType),
    }),
    [item, inventoryType, inventoryId, inventoryGroups, baseWidth, baseHeight, activeSplit]
  );

  const handleContext = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isUnsearched || isSearching || inventoryType !== 'player' || !isSlotWithItem(item)) return;
      dispatch(openContextMenu({ item, coords: { x: event.clientX, y: event.clientY } }));
    },
    [item, inventoryType, dispatch]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isUnsearched) {
        startItemSearch();
        return;
      }
      if (isSearching) return;
      dispatch(closeTooltip());
      if (timerRef.current) clearTimeout(timerRef.current);

      if (event.detail === 2 && inventoryType === 'player') {
        onUse(item);
        return;
      }

      if (event.ctrlKey && inventoryType !== 'shop' && inventoryType !== 'crafting') {
        const { inventory: state } = store.getState();
        const isLeft = inventoryType === state.leftInventory.type && state.leftInventory.items.some((i) => i != null && i.slot === item.slot);
        const isBackpack = inventoryType === 'backpack';

        let targetInv;
        if (isLeft) {
          if (state.rightInventory.id) {
            targetInv = state.rightInventory;
          } else if (state.backpackInventory.id) {
            targetInv = state.backpackInventory;
          } else {
            const moveCount = event.shiftKey && item.count > 1 ? Math.floor(item.count / 2) : item.count;
            dispatch(validateMove({
              fromSlot: item.slot,
              fromType: inventoryType,
              toSlot: 0,
              toType: 'newdrop',
              count: moveCount,
            }) as any);
            dispatch(removePlayerItem(item.slot));
            return;
          }
        } else if (isBackpack) {
          targetInv = state.leftInventory;
        } else {
          targetInv = state.leftInventory;
        }

        if (targetInv.type === 'backpack' && item.metadata?.container) return;
        if (targetInv.type === 'container' && item.metadata?.isBackpack) return;

        if (isGridInventory(targetInv.type)) {
          const itemSizes = getItemSizes();
          const gw = targetInv.gridWidth ?? 10;
          const gh = targetInv.gridHeight ?? 5;
          const occupancy = buildOccupancyGrid(gw, gh, targetInv.items, itemSizes);
          const size = getSlotEffectiveSize(item, itemSizes);
          const fit = findFirstFit(occupancy, gw, gh, size.width, size.height);
          if (!fit) return;

          const shiftHalf = event.shiftKey && item.count > 1 ? Math.floor(item.count / 2) : null;
          const moveCount = activeSplit ?? shiftHalf ?? item.count;
          const sourceInv = isLeft ? state.leftInventory : state.rightInventory;
          let maxSlot = 0;
          for (const i of sourceInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
          for (const i of targetInv.items) if (i != null && typeof i.slot === 'number' && i.slot > maxSlot) maxSlot = i.slot;
          const uniqueToSlot = maxSlot + 1;

          dispatch(validateMove({
            fromSlot: item.slot,
            fromType: inventoryType,
            toSlot: uniqueToSlot,
            toType: targetInv.type,
            count: moveCount,
            toGridX: fit.x,
            toGridY: fit.y,
            rotated: fit.rotated,
          }) as any);

          dispatch(gridMoveSlots({
            fromSlot: item,
            fromType: inventoryType,
            toType: targetInv.type,
            toSlotId: uniqueToSlot,
            count: moveCount,
            toGridX: fit.x,
            toGridY: fit.y,
            rotated: fit.rotated,
          }));

          if (activeSplit) dispatch(clearSplit());
        } else {
          onDrop({ item: { name: item.name, slot: item.slot }, inventory: inventoryType });
        }
      } else if (event.altKey && inventoryType === 'player') {
        onUse(item);
      }
    },
    [item, inventoryType, activeSplit, dispatch]
  );

  const needsCounts = inventoryType === 'shop' || inventoryType === 'crafting';
  const playerItemCounts = useAppSelector(needsCounts ? selectPlayerItemCounts : () => null);

  const imageUrl = getItemUrl(item) || 'none';
  const isRotated = item.rotated ?? false;

  const canInteract = useMemo(() => {
    if (!needsCounts) return true;
    const canBuy = canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups });
    const canCraft = canCraftItem(item, inventoryType);
    return canBuy && canCraft;
  }, [item, inventoryType, inventoryGroups, needsCounts, playerItemCounts]);

  const isShopItem = inventoryType === 'shop';
  const isCraftItem = inventoryType === 'crafting';
  const isCraftUnavailable = isCraftItem && !canInteract;
  const itemLabel = item.metadata?.label || Items[item.name]?.label || item.name;
  const isOutOfStock = isShopItem && item.count === 0;
  const ingredientCount = item.ingredients ? Object.keys(item.ingredients).length : 0;
  const durationSec = item.duration !== undefined ? (item.duration / 1000).toFixed(1) : null;

  const itemRarity = Items[item.name]?.rarity;

  const itemClassName = [
    'grid-item',
    isShopItem && 'grid-item--shop',
    isCraftItem && 'grid-item--craft',
    isCraftUnavailable && 'grid-item--craft-unavailable',
    isUnsearched && 'grid-item--unsearched',
    isSearching && 'grid-item--searching',
    wasRevealed && 'grid-item--revealing',
    itemRarity && !isUnsearched && !isSearching && `grid-item--rarity-${itemRarity}`,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={(isUnsearched || isSearching) ? undefined : drag}
      className={itemClassName}
      style={{
        gridColumn: `${(item.gridX ?? 0) + 1} / span ${effectiveW}`,
        gridRow: `${(item.gridY ?? 0) + 1} / span ${effectiveH}`,
        opacity: isDragging ? 0.25 : 1,
        filter: !canInteract && !isOutOfStock && !isUnsearched && !isSearching ? 'brightness(80%) grayscale(100%)' : undefined,
      }}
      onContextMenu={handleContext}
      onClick={handleClick}
      onMouseEnter={() => {
        if (isUnsearched || isSearching) return;
        isHovered.current = true;
        timerRef.current = window.setTimeout(() => {
          dispatch(openTooltip({ item, inventoryType }));
        }, 500) as unknown as number;
      }}
      onMouseLeave={() => {
        isHovered.current = false;
        dispatch(closeTooltip());
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }}
    >
      {(isUnsearched || isSearching) ? (
        <div className="grid-item-mystery">
          {isSearching ? (
            <div className="grid-item-search-spinner" />
          ) : (
            <span className="grid-item-mystery-icon">?</span>
          )}
        </div>
      ) : (
        <>
          {itemRarity && <div className="grid-item-rarity" />}
          <div
            className="grid-item-image"
            style={{
              backgroundImage: `url(${imageUrl})`,
              transform: isRotated ? 'rotate(90deg) scale(0.85)' : undefined,
            }}
          />
          {hotbarIndex !== -1 && <div className="grid-item-hotbar-badge">{hotbarIndex + 1}</div>}

          {isShopItem ? (
            <div className="grid-item-header">
              <span />
              {item.count > 0 && (
                <span className="grid-item-stock">{item.count}x</span>
              )}
            </div>
          ) : isCraftItem ? (
            <div className="grid-item-header">
              <span />
              {durationSec && (
                <span className="grid-item-craft-duration">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  {durationSec}s
                </span>
              )}
            </div>
          ) : (
            <div className="grid-item-header">
              <span />
              <div className="grid-item-header-right">
                {(() => {
                  const stackSize = Items[item.name]?.stackSize ?? item.stackSize;
                  if (activeSplit) {
                    return <span className="grid-item-count">{`${activeSplit}/${item.count}`}</span>;
                  }
                  if (stackSize) {
                    return <span className="grid-item-count">{`${item.count}/${stackSize}`}</span>;
                  }
                  if (item.count > 1) {
                    return <span className="grid-item-count">{`${item.count}x`}</span>;
                  }
                  return null;
                })()}
                <span className="grid-item-weight">
                  {item.weight > 0
                    ? item.weight >= 1000
                      ? `${(item.weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 1 })}kg`
                      : `${item.weight.toLocaleString('en-us', { minimumFractionDigits: 0 })}g`
                    : ''}
                </span>
              </div>
            </div>
          )}

          {isOutOfStock && (
            <div className="grid-item-sold-out">
              <span className="grid-item-sold-badge">Out of stock</span>
            </div>
          )}

          {isShopItem ? (
            <div className="grid-item-shop-footer">
              <span className="grid-item-shop-label">{itemLabel}</span>
              {item.price !== undefined && item.price > 0 && (
                <span className={`grid-item-shop-price${item.currency === 'black_money' ? ' grid-item-shop-price--dirty' : ''}`}>
                  {item.currency && item.currency !== 'money' && item.currency !== 'black_money' ? (
                    <>
                      <img src={getItemUrl(item.currency)} alt="" className="grid-item-currency-icon" />
                      {item.price.toLocaleString('en-us')}
                    </>
                  ) : (
                    <>{Locale.$ || '$'}{item.price.toLocaleString('en-us')}</>
                  )}
                </span>
              )}
            </div>
          ) : isCraftItem ? (
            <div className="grid-item-craft-footer">
              <span className="grid-item-craft-label">{itemLabel}</span>
              {ingredientCount > 0 && (
                <span className="grid-item-craft-ingredients">
                  {ingredientCount} mat{ingredientCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ) : (
            <div className="grid-item-info">
              <div className="grid-item-label">{itemLabel}</div>
              {item.durability !== undefined && (
                <div className="grid-item-durability-wrap">
                  <WeightBar percent={item.durability} durability />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(GridItem);
