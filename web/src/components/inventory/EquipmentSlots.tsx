import React, { useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { useAppSelector } from '../../store';
import { selectLeftInventory } from '../../store/inventory';
import { DragSource } from '../../typings';
import { SlotWithItem } from '../../typings/slot';
import { getItemUrl, isSlotWithItem } from '../../helpers';
import { fetchNui } from '../../utils/fetchNui';
import { Items } from '../../store/items';
import { Locale } from '../../store/locale';

type EquipType = 'backpack' | 'top' | 'vest' | 'pants' | 'pockets';

interface SlotConfig {
  type: EquipType;
  label: string;
  fallback: string;
  icon: JSX.Element;
}

const ICONS: Record<EquipType, JSX.Element> = {
  backpack: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M9 8a3 3 0 0 1 6 0" /><path d="M6 14h12" />
    </svg>
  ),
  top: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3l4 3 4-3 5 4-3 4-2-1v9H8v-9l-2 1-3-4z" />
    </svg>
  ),
  vest: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3l4 4 4-4 3 3v15h-6V11l-1 1-1-1v10H5V6z" />
    </svg>
  ),
  pants: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l-1 18h-4l-1-9-1 9H5z" />
    </svg>
  ),
  pockets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 11h16" /><path d="M9 11v4" /><path d="M15 11v4" />
    </svg>
  ),
};

const SLOT_CONFIG: SlotConfig[] = [
  { type: 'backpack', label: 'ui_equip_backpack', fallback: 'Torba', icon: ICONS.backpack },
  { type: 'top', label: 'ui_equip_top', fallback: 'Majica / Jakna', icon: ICONS.top },
  { type: 'vest', label: 'ui_equip_vest', fallback: 'Prsluk', icon: ICONS.vest },
  { type: 'pants', label: 'ui_equip_pants', fallback: 'Hlače', icon: ICONS.pants },
  { type: 'pockets', label: 'ui_equip_pockets', fallback: 'Džepovi', icon: ICONS.pockets },
];

const EquipmentSlot: React.FC<{ config: SlotConfig; item?: SlotWithItem }> = ({ config, item }) => {
  const [{ isOver, canDrop }, drop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: ['GRID_ITEM', 'SLOT'],
      canDrop: (source) => source.inventory === 'player',
      drop: (source) => {
        if (source.inventory !== 'player') return;
        fetchNui('equipItem', { slot: source.item.slot, equipType: config.type });
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [config.type]
  );

  const handleClick = () => {
    if (!item) return;
    if (config.type === 'backpack' || config.type === 'pockets') {
      fetchNui('equipItem', { slot: item.slot, equipType: config.type });
    } else {
      fetchNui('unequipItem', { equipType: config.type });
    }
  };

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (item) fetchNui('unequipItem', { equipType: config.type });
  };

  const label = Locale[config.label] || config.fallback;
  const itemLabel = item ? item.metadata?.label || Items[item.name]?.label || item.name : label;
  const imageUrl = item ? getItemUrl(item) : undefined;

  return (
    <div
      ref={drop}
      className={`equipment-slot${item ? ' equipment-slot--filled' : ''}${isOver && canDrop ? ' equipment-slot--over' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContext}
      title={itemLabel}
    >
      {imageUrl ? (
        <div className="equipment-slot-image" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : (
        <>
          <div className="equipment-slot-icon">{config.icon}</div>
          <span className="equipment-slot-label">{label}</span>
        </>
      )}
    </div>
  );
};

const EquipmentSlots: React.FC = () => {
  const leftInventory = useAppSelector(selectLeftInventory);

  const equipped = useMemo(() => {
    const map: Partial<Record<EquipType, SlotWithItem>> = {};
    for (const item of leftInventory.items) {
      if (item != null && isSlotWithItem(item) && item.metadata?.equipType) {
        map[item.metadata.equipType as EquipType] = item;
      }
    }
    return map;
  }, [leftInventory.items]);

  return (
    <div className="equipment-panel">
      <div className="equipment-panel-header">
        <span className="equipment-panel-title">{Locale.ui_equipment || 'Oprema'}</span>
      </div>
      <div className="equipment-panel-body">
        {SLOT_CONFIG.map((config) => (
          <EquipmentSlot key={config.type} config={config} item={equipped[config.type]} />
        ))}
      </div>
    </div>
  );
};

export default EquipmentSlots;
