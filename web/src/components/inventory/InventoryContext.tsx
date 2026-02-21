import { onUse } from '../../dnd/onUse';
import { onGive } from '../../dnd/onGive';
import { onDrop } from '../../dnd/onDrop';
import { Items } from '../../store/items';
import { fetchNui } from '../../utils/fetchNui';
import { Locale } from '../../store/locale';
import { getItemUrl, isSlotWithItem } from '../../helpers';
import { isGridInventory, buildOccupancyGrid, findFirstFit, getItemSize } from '../../helpers/gridUtils';
import { setClipboard } from '../../utils/setClipboard';
import { useAppSelector, useAppDispatch } from '../../store';
import { store } from '../../store';
import { gridMoveSlots } from '../../store/inventory';
import { validateMove } from '../../thunks/validateItems';
import { ItemSize } from '../../typings/grid';
import { DEFAULT_GRID_DIMENSIONS } from '../../helpers/gridConstants';
import React, { useMemo } from 'react';
import { Menu, MenuItem } from '../utils/menu/Menu';
import { setSplitAmount, closeContextMenu } from '../../store/contextMenu';

interface DataProps {
  action: string;
  component?: string;
  slot?: number;
  serial?: string;
  id?: number;
}

interface Button {
  label: string;
  index: number;
  group?: string;
}

interface Group {
  groupName: string | null;
  buttons: ButtonWithIndex[];
}

interface ButtonWithIndex extends Button {
  index: number;
}

interface GroupedButtons extends Array<Group> {}

const InventoryContext: React.FC = () => {
  const dispatch = useAppDispatch();
  const contextMenu = useAppSelector((state) => state.contextMenu);
  const item = contextMenu.item;
  const itemData = item ? Items[item.name] : null;

  const itemRarity = useMemo(() => {
    if (!item || !itemData) return undefined;
    return itemData.rarity;
  }, [item, itemData]);

  const typeLabel = useMemo(() => {
    if (!item || !itemData) return 'Item';
    return item.metadata?.type || (
      itemData.weapon ? 'Weapon' :
      itemData.component ? 'Attachment' :
      (itemData as any).ammo ? 'Ammunition' :
      (itemData as any).tint ? 'Weapon Tint' :
      Locale.ui_item || 'Item'
    );
  }, [item, itemData]);

  const handleClick = (data: DataProps) => {
    if (!item) return;

    switch (data && data.action) {
      case 'use':
        onUse({ name: item.name, slot: item.slot });
        break;
      case 'give':
        onGive({ name: item.name, slot: item.slot });
        break;
      case 'drop':
        if (isSlotWithItem(item)) {
          const { inventory: invState } = store.getState();
          const dropCount = contextMenu.splitAmount ?? item.count;
          const sourceInv = invState.leftInventory.items.some((i) => i != null && i.slot === item.slot)
            ? invState.leftInventory
            : invState.rightInventory;
          const targetInv = sourceInv === invState.leftInventory
            ? invState.rightInventory
            : invState.leftInventory;

          if (isGridInventory(sourceInv.type) && isGridInventory(targetInv.type)) {
            const itemSizes: Record<string, ItemSize | undefined> = {};
            for (const [name, d] of Object.entries(Items)) {
              if (d) itemSizes[name] = { width: d.width ?? 1, height: d.height ?? 1 };
            }
            const gw = targetInv.gridWidth ?? 10;
            const gh = targetInv.gridHeight ?? 5;
            const occupancy = buildOccupancyGrid(gw, gh, targetInv.items, itemSizes);
            const size = getItemSize(item.name, itemSizes);
            const fit = findFirstFit(occupancy, gw, gh, size.width, size.height);
            if (!fit) return;

            const uniqueToSlot = Math.max(
              ...sourceInv.items.filter((i) => i != null).map((i) => i.slot),
              ...targetInv.items.filter((i) => i != null).map((i) => i.slot),
              0
            ) + 1;

            dispatch(validateMove({
              fromSlot: item.slot,
              fromType: sourceInv.type,
              toSlot: uniqueToSlot,
              toType: targetInv.type,
              count: dropCount,
              toGridX: fit.x,
              toGridY: fit.y,
              rotated: fit.rotated,
            }) as any);

            dispatch(gridMoveSlots({
              fromSlot: item,
              fromType: sourceInv.type,
              toType: targetInv.type,
              toSlotId: uniqueToSlot,
              count: dropCount,
              toGridX: fit.x,
              toGridY: fit.y,
              rotated: fit.rotated,
            }));
          } else {
            onDrop({ item: item, inventory: 'player' });
          }
        }
        break;
      case 'remove':
        fetchNui('removeComponent', { component: data?.component, slot: data?.slot });
        break;
      case 'removeAmmo':
        fetchNui('removeAmmo', item.slot);
        break;
      case 'copy':
        setClipboard(data.serial || '');
        break;
      case 'custom':
        fetchNui('useButton', { id: (data?.id || 0) + 1, slot: item.slot });
        break;
    }

    dispatch(closeContextMenu());
  };

  const handleDetachComponent = (component: string) => {
    if (!item) return;

    fetchNui('removeComponent', { component, slot: item.slot });

    dispatch(closeContextMenu());
  };

  const groupButtons = (buttons: any): GroupedButtons => {
    return buttons.reduce((groups: Group[], button: Button, index: number) => {
      if (button.group) {
        const groupIndex = groups.findIndex((group) => group.groupName === button.group);
        if (groupIndex !== -1) {
          groups[groupIndex].buttons.push({ ...button, index });
        } else {
          groups.push({
            groupName: button.group,
            buttons: [{ ...button, index }],
          });
        }
      } else {
        groups.push({
          groupName: null,
          buttons: [{ ...button, index }],
        });
      }
      return groups;
    }, []);
  };

  const imageUrl = item ? (getItemUrl(item) || 'none') : 'none';
  const weightDisplay = item && item.weight > 0
    ? item.weight >= 1000
      ? `${(item.weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 0 })}kg`
      : `${item.weight}g`
    : '0g';

  const durabilityValue = item?.durability !== undefined ? Math.trunc(item.durability) : null;
  const durabilityColor = durabilityValue !== null
    ? durabilityValue > 60 ? '#4ade80' : durabilityValue > 25 ? '#fbbf24' : '#f87171'
    : null;

  const ammoLabel = useMemo(() => {
    if (!itemData?.ammoName) return null;
    return Items[itemData.ammoName]?.label || null;
  }, [itemData]);

  const wrapperClass = [
    'ctx-menu-wrapper',
    itemRarity && `ctx-menu-wrapper--${itemRarity}`,
  ].filter(Boolean).join(' ');

  return (
    <>
      <Menu>
        {item && itemData && (
          <div className={wrapperClass}>
            {/* Rarity accent bar */}
            {itemRarity && <div className={`ctx-rarity-bar ctx-rarity-bar--${itemRarity}`} />}

            {/* Preview header */}
            <div className="ctx-preview" onPointerDown={(e) => e.stopPropagation()}>
              <div className={`ctx-preview-img-wrap${itemRarity ? ` ctx-img--${itemRarity}` : ''}`}>
                <img src={imageUrl} alt="" className="ctx-preview-img" />
              </div>
              <div className="ctx-preview-info">
                <span className="ctx-preview-name">{item.metadata?.label || itemData.label || item.name}</span>
                <span className="ctx-preview-type">{typeLabel}</span>
              </div>
              <div className="ctx-preview-badges">
                {itemRarity && (
                  <span className={`ctx-rarity-badge ctx-rarity-badge--${itemRarity}`}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {Locale[`rarity_${itemRarity}` as keyof typeof Locale] || itemRarity}
                  </span>
                )}
                <span className="ctx-weight-badge">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  </svg>
                  {weightDisplay}
                </span>
              </div>
            </div>

            {/* Durability bar */}
            {durabilityValue !== null && (
              <div className="ctx-durability" onPointerDown={(e) => e.stopPropagation()}>
                <div className="ctx-durability-label">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span>{Locale.ui_durability || 'Durability'}</span>
                </div>
                <div className="ctx-durability-right">
                  <div className="ctx-durability-track">
                    <div
                      className="ctx-durability-fill"
                      style={{ width: `${durabilityValue}%`, background: durabilityColor || undefined }}
                    />
                  </div>
                  <span className="ctx-durability-text" style={{ color: durabilityColor || undefined }}>{durabilityValue}%</span>
                </div>
              </div>
            )}

            {/* Ammo info */}
            {(item.metadata?.ammo !== undefined || ammoLabel) && (
              <div className="ctx-ammo-info" onPointerDown={(e) => e.stopPropagation()}>
                {item.metadata?.ammo !== undefined && (
                  <div className="ctx-ammo-row">
                    <span className="ctx-ammo-label">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="8" y="2" width="8" height="16" rx="2"/><rect x="9" y="18" width="6" height="4" rx="1"/>
                      </svg>
                      {Locale.ui_ammo || 'Ammo'}
                    </span>
                    <span className="ctx-ammo-value">{item.metadata.ammo}</span>
                  </div>
                )}
                {ammoLabel && (
                  <div className="ctx-ammo-row">
                    <span className="ctx-ammo-label">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="2" width="5" height="14" rx="2"/><rect x="7" y="16" width="3" height="4" rx="0.5"/><rect x="14" y="5" width="5" height="11" rx="2"/><rect x="15" y="16" width="3" height="4" rx="0.5"/>
                      </svg>
                      {Locale.ammo_type || 'Ammo Type'}
                    </span>
                    <span className="ctx-ammo-value">{ammoLabel}</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount slider */}
            {item.count > 1 && (
              <div className="ctx-amount-section" onPointerDown={(e) => e.stopPropagation()}>
                <div className="ctx-amount-header">
                  <span className="ctx-amount-label">AMOUNT</span>
                  <span className="ctx-amount-value">{contextMenu.splitAmount ?? item.count}</span>
                </div>
                <input
                  type="range"
                  className="ctx-amount-slider"
                  min={1}
                  max={item.count}
                  value={contextMenu.splitAmount ?? item.count}
                  onChange={(e) => dispatch(setSplitAmount(parseInt(e.target.value)))}
                />
              </div>
            )}

            {/* Primary actions */}
            <div className="ctx-actions-primary">
              <button className="ctx-btn" onClick={() => handleClick({ action: 'use' })}>
                {Locale.ui_use || 'Use'}
              </button>
              <button className="ctx-btn" onClick={() => handleClick({ action: 'give' })}>
                {Locale.ui_give || 'Give'}
              </button>
              <button className="ctx-btn ctx-btn--drop" onClick={() => handleClick({ action: 'drop' })}>
                {Locale.ui_drop || 'Drop'}
              </button>
            </div>

            {/* Secondary actions */}
            {(item.metadata?.ammo > 0 || item.metadata?.serial || (item.name && (Items[item.name]?.buttons?.length ?? 0) > 0)) && (
              <div className="ctx-actions-secondary">
                {item.metadata?.ammo > 0 && (
                  <button className="ctx-btn-secondary" onClick={() => handleClick({ action: 'removeAmmo' })}>
                    {Locale.ui_remove_ammo || 'Remove Ammo'}
                  </button>
                )}
                {item.metadata?.serial && (
                  <button className="ctx-btn-secondary" onClick={() => handleClick({ action: 'copy', serial: item.metadata?.serial })}>
                    {Locale.ui_copy || 'Copy Serial'}
                  </button>
                )}
                {item.name && (Items[item.name]?.buttons?.length ?? 0) > 0 &&
                  groupButtons(Items[item.name]?.buttons).map((group: Group, index: number) => (
                    <React.Fragment key={index}>
                      {group.groupName ? (
                        <Menu label={group.groupName}>
                          {group.buttons.map((button: Button) => (
                            <MenuItem
                              key={button.index}
                              onClick={() => handleClick({ action: 'custom', id: button.index })}
                              label={button.label}
                            />
                          ))}
                        </Menu>
                      ) : (
                        group.buttons.map((button: Button) => (
                          <button
                            key={button.index}
                            className="ctx-btn-secondary"
                            onClick={() => handleClick({ action: 'custom', id: button.index })}
                          >
                            {button.label}
                          </button>
                        ))
                      )}
                    </React.Fragment>
                  ))}
              </div>
            )}

            {/* Attachments (separate section) */}
            {item.metadata?.components && item.metadata.components.length > 0 && (
              <div className="ctx-attachments" onPointerDown={(e) => e.stopPropagation()}>
                <span className="ctx-attachments-header">
                  {Locale.ui_removeattachments || 'Attachments'}
                </span>
                <div className="ctx-attachments-grid">
                  {item.metadata.components.map((component: string, index: number) => {
                    const compData = Items[component];
                    const compImgUrl = getItemUrl(component) || 'none';
                    return (
                      <button
                        key={index}
                        className="ctx-attachment-chip"
                        onClick={() => handleDetachComponent(component)}
                        title={`Remove ${compData?.label || component}`}
                      >
                        <img src={compImgUrl} alt="" className="ctx-attachment-chip-img" />
                        <span className="ctx-attachment-chip-label">{compData?.label || component}</span>
                        <span className="ctx-attachment-chip-x">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Menu>
    </>
  );
};

export default InventoryContext;
