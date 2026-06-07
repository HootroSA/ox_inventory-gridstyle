import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDrop } from 'react-dnd';
import { batch } from 'react-redux';
import useNuiEvent from '../../hooks/useNuiEvent';
import InventoryHotbar from './InventoryHotbar';
import { useAppDispatch, useAppSelector } from '../../store';
import { store } from '../../store';
import { refreshSlots, setAdditionalMetadata, setupInventory, restoreHotbar, selectLeftInventory, selectRightInventory, selectBackpackInventory, selectEquipmentInventories, setupBackpack, closeBackpack, setupEquipment, closeEquipment, removePlayerItem, removeBackpackItem, clearCraftQueue } from '../../store/inventory';
import GridInventory from './GridInventory';
import { reconcileHotbar } from '../../helpers/hotbarPersistence';
import { useExitListener } from '../../hooks/useExitListener';
import type { Inventory as InventoryProps } from '../../typings';
import { DragSource } from '../../typings';
import RightInventory from './RightInventory';
import LeftInventory from './LeftInventory';
import BackpackInventory from './BackpackInventory';
import EquipmentSlots from './EquipmentSlots';
import Tooltip from '../utils/Tooltip';
import { closeTooltip } from '../../store/tooltip';
import InventoryContext from './InventoryContext';
import { closeContextMenu } from '../../store/contextMenu';
import Fade from '../utils/transitions/Fade';
import UsefulControls from './UsefulControls';
import { usePanelDrag } from '../../hooks/usePanelDrag';
import { isSlotWithItem } from '../../helpers';
import { validateMove } from '../../thunks/validateItems';
import { fetchNui } from '../../utils/fetchNui';

const Inventory: React.FC = () => {
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [focusedPanel, setFocusedPanel] = useState<'left' | 'right'>('left');
  const dispatch = useAppDispatch();
  const leftInventory = useAppSelector(selectLeftInventory);
  const rightInventory = useAppSelector(selectRightInventory);
  const hasRightInventory = useMemo(() => {
    if (rightInventory.type === '' || rightInventory.id === '') return false;
    if ((rightInventory.type === 'drop' || rightInventory.type === 'newdrop') &&
        !rightInventory.items.some((item) => item != null && isSlotWithItem(item))) return false;
    return true;
  }, [rightInventory.type, rightInventory.id, rightInventory.items]);

  const backpackInventory = useAppSelector(selectBackpackInventory);
  const equipmentInventories = useAppSelector(selectEquipmentInventories);
  const hasBackpack = useMemo(() =>
    backpackInventory.type === 'backpack' && backpackInventory.id !== '',
    [backpackInventory.type, backpackInventory.id]
  );

  // Auto-open the backpack panel whenever the inventory is open and a backpack
  // is worn in the equipment (Torba) slot, and keep it open while it stays worn.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!inventoryVisible) {
      autoOpenedRef.current = false;
      return;
    }
    if (backpackInventory.id || autoOpenedRef.current) return;
    const worn = leftInventory.items.find(
      (i) => i != null && i.metadata?.equipType === 'backpack' && i.metadata?.isBackpack
    );
    if (worn) {
      autoOpenedRef.current = true;
      fetchNui('equipItem', { slot: worn.slot, equipType: 'backpack' });
    }
  }, [inventoryVisible, leftInventory.items, backpackInventory.id]);

  const leftDrag = usePanelDrag('ox_inv_panel_left');
  const rightDrag = usePanelDrag('ox_inv_panel_right');
  const backpackDrag = usePanelDrag('ox_inv_panel_backpack');

  useEffect(() => {
    if (hasRightInventory && leftDrag.position && !rightDrag.position) {
      const leftEl = leftDrag.panelRef.current;
      if (leftEl) {
        rightDrag.setPosition({
          x: leftDrag.position.x + leftEl.offsetWidth + 16,
          y: leftDrag.position.y,
        });
      }
    }
  }, [hasRightInventory]);

  const handleLeftHeaderDown = useCallback((e: React.MouseEvent) => {
    setFocusedPanel('left');
    if (leftDrag.isLocked) return;
    if (!leftDrag.position && rightDrag.panelRef.current && !rightDrag.position) {
      rightDrag.capturePosition();
    }
    leftDrag.onMouseDown(e);
  }, [leftDrag.onMouseDown, leftDrag.position, leftDrag.isLocked, rightDrag.position, rightDrag.capturePosition]);

  const handleRightHeaderDown = useCallback((e: React.MouseEvent) => {
    setFocusedPanel('right');
    if (rightDrag.isLocked) return;
    if (!rightDrag.position && leftDrag.panelRef.current && !leftDrag.position) {
      leftDrag.capturePosition();
    }
    rightDrag.onMouseDown(e);
  }, [rightDrag.onMouseDown, rightDrag.position, rightDrag.isLocked, leftDrag.position, leftDrag.capturePosition]);

  const handleBackpackHeaderDown = useCallback((e: React.MouseEvent) => {
    setFocusedPanel('left');
    if (backpackDrag.isLocked) return;
    backpackDrag.onMouseDown(e);
  }, [backpackDrag.onMouseDown, backpackDrag.isLocked]);

  useNuiEvent<boolean>('setInventoryVisible', setInventoryVisible);
  useNuiEvent<false>('closeInventory', () => {
    batch(() => {
      setInventoryVisible(false);
      setInfoVisible(false);
      dispatch(closeContextMenu());
      dispatch(closeTooltip());
      dispatch(clearCraftQueue());
      dispatch(closeEquipment());
    });
  });
  useExitListener(setInventoryVisible);

  useNuiEvent<{
    leftInventory?: InventoryProps;
    rightInventory?: InventoryProps;
  }>('setupInventory', (data) => {
    dispatch(setupInventory(data));
    if (data.leftInventory) {
      dispatch(restoreHotbar(reconcileHotbar(data.leftInventory.items)));
    }
    !inventoryVisible && setInventoryVisible(true);
  });

  useNuiEvent('refreshSlots', (data) => dispatch(refreshSlots(data)));

  // Automatically tidy newly opened panels (backpack + player-owned containers).
  const SORTABLE_RIGHT = ['container', 'backpack', 'trunk', 'glovebox', 'stash'];
  const sortedRightRef = useRef('');
  useEffect(() => {
    if (hasRightInventory && rightInventory.id !== sortedRightRef.current && SORTABLE_RIGHT.includes(rightInventory.type)) {
      sortedRightRef.current = rightInventory.id;
      fetchNui('sortInventory', { inventoryId: rightInventory.id });
    }
    if (!hasRightInventory) sortedRightRef.current = '';
  }, [hasRightInventory, rightInventory.id, rightInventory.type]);

  const sortedBackpackRef = useRef('');
  useEffect(() => {
    if (hasBackpack && backpackInventory.id !== sortedBackpackRef.current) {
      sortedBackpackRef.current = backpackInventory.id;
      fetchNui('sortInventory', { inventoryId: backpackInventory.id });
    }
    if (!hasBackpack) sortedBackpackRef.current = '';
  }, [hasBackpack, backpackInventory.id]);

  useNuiEvent<{ backpackInventory: InventoryProps }>('setupBackpack', (data) => {
    dispatch(setupBackpack(data.backpackInventory));
  });
  useNuiEvent('closeBackpack', () => dispatch(closeBackpack()));

  useNuiEvent<{ equipment: InventoryProps[] }>('setupEquipment', (data) => {
    dispatch(setupEquipment(data.equipment || []));
  });
  useNuiEvent('closeEquipment', () => dispatch(closeEquipment()));

  useNuiEvent('displayMetadata', (data: Array<{ metadata: string; value: string }>) => {
    dispatch(setAdditionalMetadata(data));
  });

  const [, groundDrop] = useDrop<DragSource, void, {}>(() => ({
    accept: ['GRID_ITEM', 'SLOT'],
    drop: (source, monitor) => {
      if (monitor.didDrop()) return;

      const clientOffset = monitor.getClientOffset();
      if (clientOffset) {
        const panels = [
          leftDrag.panelRef.current,
          backpackDrag.panelRef.current,
          rightDrag.panelRef.current,
        ];
        for (const panel of panels) {
          if (!panel) continue;
          const rect = panel.getBoundingClientRect();
          if (
            clientOffset.x >= rect.left && clientOffset.x <= rect.right &&
            clientOffset.y >= rect.top && clientOffset.y <= rect.bottom
          ) {
            return;
          }
        }
      }

      const { inventory: state } = store.getState();

      let sourceItem;
      let fromType: string;
      if (source.inventory === 'backpack' || source.inventoryId === state.backpackInventory.id) {
        sourceItem = state.backpackInventory.items.find((i) => i != null && i.slot === source.item.slot);
        fromType = 'backpack';
      } else {
        sourceItem = state.leftInventory.items.find((i) => i != null && i.slot === source.item.slot);
        fromType = 'player';
      }
      if (!sourceItem || !isSlotWithItem(sourceItem)) return;

      if (fromType === 'player' && sourceItem.metadata?.isBackpack && state.backpackInventory.id) {
        fetchNui('closeBackpack');
        dispatch(closeBackpack());
      }

      const count = state.shiftPressed && sourceItem.count > 1
        ? Math.floor(sourceItem.count / 2)
        : sourceItem.count;

      dispatch(
        validateMove({
          fromSlot: sourceItem.slot,
          fromType,
          toSlot: 0,
          toType: 'newdrop',
          count,
        }) as any
      );

      if (fromType === 'backpack') {
        dispatch(removeBackpackItem(sourceItem.slot));
      } else {
        dispatch(removePlayerItem(sourceItem.slot));
      }
    },
  }), [dispatch]);

  const leftPositioned = leftDrag.position !== null;
  const rightPositioned = rightDrag.position !== null;
  const backpackPositioned = backpackDrag.position !== null;

  return (
    <>
      <UsefulControls infoVisible={infoVisible} setInfoVisible={setInfoVisible} />
      <Fade in={inventoryVisible}>
        <div ref={groundDrop} className="inventory-wrapper">
          <div
            ref={leftDrag.panelRef}
            className={`inventory-panel inventory-panel--left${leftPositioned ? ' inventory-panel--positioned' : ''}${leftDrag.isDragging ? ' inventory-panel--dragging' : ''}`}
            style={leftPositioned ? {
              left: leftDrag.position!.x,
              top: leftDrag.position!.y,
              zIndex: focusedPanel === 'left' ? 100 : 50,
            } : {
              zIndex: focusedPanel === 'left' ? 100 : 50,
            }}
            onMouseDown={() => setFocusedPanel('left')}
          >
            <div className="left-panel-row">
              <EquipmentSlots />
              <LeftInventory
                onHeaderMouseDown={handleLeftHeaderDown}
                isLocked={leftDrag.isLocked}
                onToggleLock={leftDrag.toggleLock}
                onOpenInfo={() => setInfoVisible(true)}
              />
            </div>
          </div>
          {(hasBackpack || equipmentInventories.length > 0) && (
            <div className="equipment-cargo-stack">
              {hasBackpack && (
                <div
                  ref={backpackDrag.panelRef}
                  className="inventory-panel inventory-panel--active equipment-cargo-section"
                >
                  <BackpackInventory />
                </div>
              )}
              {equipmentInventories.map((inv) => (
                <div key={inv.id} className="inventory-panel inventory-panel--active equipment-cargo-section">
                  <GridInventory
                    inventory={inv}
                    onClose={() => fetchNui('unequipItem', { equipType: inv.equipType })}
                  />
                </div>
              ))}
            </div>
          )}
          <div
            ref={rightDrag.panelRef}
            className={`inventory-panel inventory-panel--right${hasRightInventory ? ' inventory-panel--active' : ''}${rightPositioned ? ' inventory-panel--positioned' : ''}${rightDrag.isDragging ? ' inventory-panel--dragging' : ''}`}
            style={rightPositioned ? {
              left: rightDrag.position!.x,
              top: rightDrag.position!.y,
              zIndex: focusedPanel === 'right' ? 100 : 50,
            } : {
              zIndex: focusedPanel === 'right' ? 100 : 50,
            }}
            onMouseDown={() => setFocusedPanel('right')}
          >
            {hasRightInventory && (
              <RightInventory
                onHeaderMouseDown={handleRightHeaderDown}
                isLocked={rightDrag.isLocked}
                onToggleLock={rightDrag.toggleLock}
              />
            )}
          </div>
          <Tooltip />
          <InventoryContext />
        </div>
      </Fade>
      <InventoryHotbar />
    </>
  );
};

export default Inventory;
