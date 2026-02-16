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
import React from 'react';
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
          const sourceInv = invState.leftInventory.items.some((i) => i.slot === item.slot)
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
              ...sourceInv.items.map((i) => i.slot),
              ...targetInv.items.map((i) => i.slot),
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

  return (
    <>
      <Menu>
        {item && itemData && (
          <div className="ctx-preview" onPointerDown={(e) => e.stopPropagation()}>
            <div className="ctx-preview-img-wrap">
              <img src={imageUrl} alt="" className="ctx-preview-img" />
            </div>
            <div className="ctx-preview-info">
              <span className="ctx-preview-name">{item.metadata?.label || itemData.label || item.name}</span>
              <span className="ctx-preview-type">{item.metadata?.type || (Locale.ui_item || 'Item')}</span>
              <div className="ctx-preview-stats">
                <span className="ctx-preview-stat">{weightDisplay}</span>
                {item.count > 1 && <span className="ctx-preview-stat ctx-preview-stat--accent">x{item.count}</span>}
              </div>
              {durabilityValue !== null && (
                <div className="ctx-durability">
                  <div className="ctx-durability-track">
                    <div
                      className="ctx-durability-fill"
                      style={{ width: `${durabilityValue}%`, background: durabilityColor || undefined }}
                    />
                  </div>
                  <span className="ctx-durability-text" style={{ color: durabilityColor || undefined }}>{durabilityValue}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {item && item.count > 1 && (
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

        <div className="ctx-actions">
          <button className="ctx-action" onClick={() => handleClick({ action: 'use' })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>{Locale.ui_use || 'Use'}</span>
          </button>
          <button className="ctx-action" onClick={() => handleClick({ action: 'give' })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7l-10 10"/><path d="M8 7h9v9"/></svg>
            <span>{Locale.ui_give || 'Give'}</span>
          </button>
          <button className="ctx-action ctx-action--drop" onClick={() => handleClick({ action: 'drop' })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/></svg>
            <span>{Locale.ui_drop || 'Drop'}</span>
          </button>
        </div>

        {item && (item.metadata?.ammo > 0 || item.metadata?.serial || (item.metadata?.components && item.metadata.components.length > 0) || (item.name && Items[item.name]?.buttons?.length)) && (
          <div className="ctx-extra">
            {item.metadata?.ammo > 0 && (
              <MenuItem onClick={() => handleClick({ action: 'removeAmmo' })} label={Locale.ui_remove_ammo} />
            )}
            {item.metadata?.serial && (
              <MenuItem
                onClick={() => handleClick({ action: 'copy', serial: item.metadata?.serial })}
                label={Locale.ui_copy}
              />
            )}
            {item.metadata?.components && item.metadata.components.length > 0 && (
              <div className="ctx-attachments" onPointerDown={(e) => e.stopPropagation()}>
                <span className="ctx-attachments-header">{Locale.ui_removeattachments || 'ATTACHMENTS'}</span>
                <div className="ctx-attachments-grid">
                  {item.metadata.components.map((component: string, index: number) => {
                    const compData = Items[component];
                    const compImgUrl = getItemUrl(component) || 'none';
                    const compType = compData?.type || '';
                    return (
                      <button
                        key={index}
                        className="ctx-attachment-icon"
                        onClick={() => handleDetachComponent(component)}
                        title={`${compData?.label || component}${compType ? ` (${compType})` : ''}`}
                      >
                        <img src={compImgUrl} alt="" className="ctx-attachment-icon-img" />
                        <span className="ctx-attachment-icon-x">
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
                      <MenuItem
                        key={button.index}
                        onClick={() => handleClick({ action: 'custom', id: button.index })}
                        label={button.label}
                      />
                    ))
                  )}
                </React.Fragment>
              ))}
          </div>
        )}
      </Menu>
    </>
  );
};

export default InventoryContext;
