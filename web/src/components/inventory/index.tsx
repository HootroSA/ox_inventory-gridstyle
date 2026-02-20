import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { batch } from 'react-redux';
import useNuiEvent from '../../hooks/useNuiEvent';
import InventoryHotbar from './InventoryHotbar';
import { useAppDispatch, useAppSelector } from '../../store';
import { store } from '../../store';
import { refreshSlots, setAdditionalMetadata, setupInventory, restoreHotbar, selectRightInventory, selectBackpackInventory, setupBackpack, closeBackpack, removePlayerItem, removeBackpackItem, clearCraftQueue } from '../../store/inventory';
import { reconcileHotbar } from '../../helpers/hotbarPersistence';
import { useExitListener } from '../../hooks/useExitListener';
import type { Inventory as InventoryProps } from '../../typings';
import { DragSource } from '../../typings';
import RightInventory from './RightInventory';
import LeftInventory from './LeftInventory';
import BackpackInventory from './BackpackInventory';
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
  const rightInventory = useAppSelector(selectRightInventory);
  const hasRightInventory = useMemo(() => {
    if (rightInventory.type === '' || rightInventory.id === '') return false;
    if ((rightInventory.type === 'drop' || rightInventory.type === 'newdrop') &&
        !rightInventory.items.some((item) => item != null && isSlotWithItem(item))) return false;
    return true;
  }, [rightInventory.type, rightInventory.id, rightInventory.items]);

  const backpackInventory = useAppSelector(selectBackpackInventory);
  const hasBackpack = useMemo(() =>
    backpackInventory.type === 'backpack' && backpackInventory.id !== '',
    [backpackInventory.type, backpackInventory.id]
  );

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

  useNuiEvent<{ backpackInventory: InventoryProps }>('setupBackpack', (data) => {
    dispatch(setupBackpack(data.backpackInventory));
  });
  useNuiEvent('closeBackpack', () => dispatch(closeBackpack()));

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
            <LeftInventory
              onHeaderMouseDown={handleLeftHeaderDown}
              isLocked={leftDrag.isLocked}
              onToggleLock={leftDrag.toggleLock}
            />
          </div>
          <div
            ref={backpackDrag.panelRef}
            className={`inventory-panel inventory-panel--backpack${hasBackpack ? ' inventory-panel--active' : ''}${backpackPositioned ? ' inventory-panel--positioned' : ''}${backpackDrag.isDragging ? ' inventory-panel--dragging' : ''}`}
            style={backpackPositioned ? {
              left: backpackDrag.position!.x,
              top: backpackDrag.position!.y,
            } : {}}
          >
            {hasBackpack && (
              <BackpackInventory
                onHeaderMouseDown={handleBackpackHeaderDown}
                isLocked={backpackDrag.isLocked}
                onToggleLock={backpackDrag.toggleLock}
              />
            )}
          </div>
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
          <button className="useful-controls-button" onClick={() => setInfoVisible(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" height="2em" viewBox="0 0 524 524">
              <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
            </svg>
          </button>
        </div>
      </Fade>
      <InventoryHotbar />
    </>
  );
};

export default Inventory;
