import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Inventory } from '../../typings';
import WeightBar from '../utils/WeightBar';
import InventorySlot from './InventorySlot';
import { getTotalWeight } from '../../helpers';
import { useAppSelector } from '../../store';
import { useIntersection } from '../../hooks/useIntersection';
import { getTypeIcon } from '../../helpers/getTypeIcon';

const PAGE_SIZE = 30;

interface InventoryGridProps {
  inventory: Inventory;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({ inventory, onHeaderMouseDown, isLocked, onToggleLock }) => {
  const weight = useMemo(
    () => (inventory.maxWeight !== undefined ? Math.floor(getTotalWeight(inventory.items) * 1000) / 1000 : 0),
    [inventory.maxWeight, inventory.items]
  );
  const [page, setPage] = useState(0);
  const containerRef = useRef(null);
  const { ref, entry } = useIntersection({ threshold: 0.5 });
  const isBusy = useAppSelector((state) => state.inventory.isBusy);

  useEffect(() => {
    if (entry && entry.isIntersecting) {
      setPage((prev) => ++prev);
    }
  }, [entry]);
  return (
    <>
      <div className="slot-inventory-wrapper" data-inv-type={inventory.type} style={{ pointerEvents: isBusy ? 'none' : 'auto' }}>
        <div>
          <div className={`slot-inventory-header${isLocked ? ' header--locked' : ''}`} onMouseDown={onHeaderMouseDown}>
            <div className="slot-header-left">
              <div className="slot-header-icon-wrap">
                {getTypeIcon(inventory.type)}
              </div>
              <span className="slot-header-label">{inventory.label}</span>
            </div>
            {inventory.maxWeight !== undefined && inventory.maxWeight > 0 && (
              <div className="slot-header-right">
                <span className="slot-header-weight">
                  {(weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className="slot-header-weight-separator">/</span>
                  {(inventory.maxWeight / 1000).toLocaleString('en-us', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}kg
                </span>
              </div>
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
          </div>
          <WeightBar percent={inventory.maxWeight ? (weight / inventory.maxWeight) * 100 : 0} />
        </div>
        <div className="slot-inventory-container" ref={containerRef}>
          <>
            {inventory.items.slice(0, (page + 1) * PAGE_SIZE).map((item, index) => (
              <InventorySlot
                key={`${inventory.type}-${inventory.id}-${item.slot}`}
                item={item}
                ref={index === (page + 1) * PAGE_SIZE - 1 ? ref : null}
                inventoryType={inventory.type}
                inventoryGroups={inventory.groups}
                inventoryId={inventory.id}
              />
            ))}
          </>
        </div>
      </div>
    </>
  );
};

export default InventoryGrid;
