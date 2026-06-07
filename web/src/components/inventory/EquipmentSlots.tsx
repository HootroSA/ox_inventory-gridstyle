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

type EquipType = 'hat' | 'shirt' | 'jacket' | 'vest' | 'pants' | 'shoes' | 'backpack' | 'pockets';

interface SlotConfig {
  type: EquipType;
  label: string;
  fallback: string;
  icon: JSX.Element;
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<EquipType, JSX.Element> = {
  hat: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M5 16c0-5 3-9 7-9s7 4 7 9" />
      <path d="M3 16h18" /><path d="M16 8l3-3" />
    </svg>
  ),
  shirt: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M8 3l4 3 4-3 4 3-2.5 3.5L20 11v10H4V11l2.5-1.5L4 6z" />
    </svg>
  ),
  jacket: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M8 3l4 2 4-2 4 4-2 2v12h-5V9l-1 1-1-1v12H6V9L4 7z" />
      <path d="M12 5v16" />
    </svg>
  ),
  vest: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M8 3l4 4 4-4 3 3v15h-6V11l-1 1-1-1v10H5V6z" />
      <path d="M9 12h2M13 12h2" />
    </svg>
  ),
  pants: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M7 3h10v3l-1 15h-4l-1-10-1 10H6l-1-15V3" />
      <path d="M7 3h10" />
    </svg>
  ),
  shoes: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M3 7v7c0 1 .5 2 2 2h13c2 0 3-1 3-2.5 0-1-.6-1.7-2-2.3l-6-2.7-2-3z" />
      <path d="M3 13h17" />
    </svg>
  ),
  backpack: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M6 9a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M9 9a3 3 0 0 1 6 0" /><path d="M8 14h8v4H8z" />
    </svg>
  ),
  pockets: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 11h16M9 11v4M15 11v4" />
    </svg>
  ),
};

const SLOT_CONFIG: SlotConfig[] = [
  { type: 'hat', label: 'ui_equip_hat', fallback: 'Kapa', icon: ICONS.hat },
  { type: 'shirt', label: 'ui_equip_shirt', fallback: 'Majica', icon: ICONS.shirt },
  { type: 'jacket', label: 'ui_equip_jacket', fallback: 'Jakna', icon: ICONS.jacket },
  { type: 'vest', label: 'ui_equip_vest', fallback: 'Prsluk', icon: ICONS.vest },
  { type: 'pants', label: 'ui_equip_pants', fallback: 'Hlače', icon: ICONS.pants },
  { type: 'shoes', label: 'ui_equip_shoes', fallback: 'Obuća', icon: ICONS.shoes },
  { type: 'backpack', label: 'ui_equip_backpack', fallback: 'Torba', icon: ICONS.backpack },
  { type: 'pockets', label: 'ui_equip_pockets', fallback: 'Džepovi', icon: ICONS.pockets },
];

const CONTAINER_TYPES: EquipType[] = ['backpack', 'pockets'];

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
    if (CONTAINER_TYPES.includes(config.type)) {
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
      <div className="equipment-slot-icon">{config.icon}</div>
      {imageUrl && <div className="equipment-slot-image" style={{ backgroundImage: `url(${imageUrl})` }} />}
      <span className="equipment-slot-label">{item ? itemLabel : label}</span>
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
