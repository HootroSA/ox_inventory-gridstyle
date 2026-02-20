import InventoryComponent from './components/inventory';
import useNuiEvent from './hooks/useNuiEvent';
import { Items } from './store/items';
import { Locale } from './store/locale';
import { setImagePath } from './store/imagepath';
import { setupInventory, assignHotbar, restoreHotbar } from './store/inventory';
import { Inventory } from './typings';
import { useAppDispatch } from './store';
import { store } from './store';
import { debugData } from './utils/debugData';
import GridDragPreview from './components/inventory/GridDragPreview';
import { fetchNui } from './utils/fetchNui';
import { useDragDropManager } from 'react-dnd';
import KeyPress from './components/utils/KeyPress';
import { isSlotWithItem } from './helpers';
import { isEnvBrowser } from './utils/misc';
import { COMPONENT_SIZE_MODIFIERS } from './helpers/gridConstants';
import { reconcileHotbar, loadBindingsFromServer } from './helpers/hotbarPersistence';
import { useState, useCallback, useEffect } from 'react';

const playerInventory = {
  id: 'test',
  type: 'player',
  slots: 70,
  label: 'My Ass',
  weight: 18500,
  maxWeight: 50000,
  gridWidth: 10,
  gridHeight: 7,
  items: [
    {
      slot: 1,
      name: 'weapon_assaultrifle',
      weight: 4500,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      metadata: { durability: 92, serial: 'AR-4821', ammo: 30, description: 'Standard issue assault rifle\nAmmo: 5.56mm', components: ['at_scope_macro', 'at_grip'] },
    },
    {
      slot: 2,
      name: 'armour',
      weight: 3500,
      count: 1,
      gridX: 5,
      gridY: 0,
      rotated: false,
      metadata: { durability: 68, description: 'Level III body armor\nProvides torso protection' },
    },
    {
      slot: 3,
      name: 'weapon_pistol',
      weight: 1500,
      count: 1,
      gridX: 7,
      gridY: 0,
      rotated: false,
      metadata: { durability: 45, serial: 'P-9912', ammo: 12, description: '9mm semi-automatic pistol', components: [] },
    },
    {
      slot: 4,
      name: 'water',
      weight: 500,
      count: 3,
      gridX: 9,
      gridY: 0,
      rotated: false,
      metadata: { description: 'Clean drinking water' },
    },
    {
      slot: 7,
      name: 'weapon_smg',
      weight: 2800,
      count: 1,
      gridX: 7,
      gridY: 1,
      rotated: true,
      metadata: { durability: 80, serial: 'SMG-3345', ammo: 24, components: [] },
    },
    {
      slot: 8,
      name: 'medkit',
      weight: 1000,
      count: 1,
      gridX: 0,
      gridY: 2,
      rotated: false,
      metadata: { durability: 100, description: 'Full medical kit with bandages, antiseptic, and splints' },
    },
    {
      slot: 9,
      name: 'knife',
      weight: 300,
      count: 1,
      gridX: 2,
      gridY: 2,
      rotated: false,
      metadata: { durability: 55 },
    },
    {
      slot: 10,
      name: 'bandage',
      weight: 100,
      count: 20,
      stack: true,
      stackSize: 20,
      gridX: 3,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 11,
      name: 'ammo_9mm',
      weight: 200,
      count: 60,
      gridX: 4,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 12,
      name: 'burger',
      weight: 300,
      count: 3,
      gridX: 3,
      gridY: 3,
      rotated: false,
    },
    {
      slot: 13,
      name: 'lockpick',
      weight: 200,
      count: 2,
      stack: true,
      stackSize: 15,
      gridX: 4,
      gridY: 3,
      rotated: false,
    },
    {
      slot: 14,
      name: 'water',
      weight: 500,
      count: 1,
      gridX: 5,
      gridY: 3,
      rotated: false,
    },
    {
      slot: 5,
      name: 'radio',
      weight: 400,
      count: 1,
      gridX: 0,
      gridY: 4,
      rotated: false,
      metadata: { description: 'Handheld radio\nFrequency: 145.5 MHz' },
    },
    {
      slot: 6,
      name: 'phone',
      weight: 200,
      count: 1,
      gridX: 1,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 15,
      name: 'at_suppressor_light',
      weight: 280,
      count: 1,
      gridX: 2,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 16,
      name: 'at_scope_macro',
      weight: 200,
      count: 1,
      gridX: 3,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 17,
      name: 'at_clip_extended',
      weight: 150,
      count: 1,
      gridX: 4,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 18,
      name: 'at_grip',
      weight: 280,
      count: 1,
      gridX: 5,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 19,
      name: 'at_flashlight',
      weight: 120,
      count: 1,
      gridX: 6,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 20,
      name: 'at_suppressor_heavy',
      weight: 280,
      count: 1,
      gridX: 7,
      gridY: 4,
      rotated: false,
    },
    {
      slot: 21,
      name: 'bandage',
      weight: 100,
      count: 5,
      stack: true,
      stackSize: 20,
      gridX: 1,
      gridY: 5,
      rotated: false,
    },
    {
      slot: 22,
      name: 'lockpick',
      weight: 200,
      count: 12,
      stack: true,
      stackSize: 15,
      gridX: 2,
      gridY: 5,
      rotated: false,
    },
    {
      slot: 23,
      name: 'bandage',
      weight: 100,
      count: 15,
      stack: true,
      stackSize: 20,
      gridX: 3,
      gridY: 5,
      rotated: false,
    },
  ],
};

const stashInventory = {
  id: 'stash_test',
  type: 'stash',
  slots: 70,
  label: 'Personal Stash',
  weight: 8200,
  maxWeight: 100000,
  gridWidth: 10,
  gridHeight: 7,
  searchable: true,
  unsearchedCount: 4,
  items: [
    {
      slot: 101,
      name: 'weapon_assaultrifle',
      weight: 4500,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      searched: true,
      metadata: { durability: 30, serial: 'AR-1100', ammo: 5, description: 'Worn assault rifle\nNeeds repair', components: [] },
    },
    {
      slot: 102,
      name: 'medkit',
      weight: 1000,
      count: 1,
      gridX: 5,
      gridY: 0,
      rotated: false,
      searched: false,
      metadata: { durability: 50 },
    },
    {
      slot: 103,
      name: 'water',
      weight: 500,
      count: 5,
      gridX: 7,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 104,
      name: 'ammo_9mm',
      weight: 200,
      count: 120,
      gridX: 8,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 105,
      name: 'bandage',
      weight: 100,
      count: 10,
      stack: true,
      stackSize: 20,
      gridX: 9,
      gridY: 0,
      rotated: false,
      searched: true,
    },
    {
      slot: 106,
      name: 'weapon_pistol',
      weight: 1500,
      count: 1,
      gridX: 0,
      gridY: 2,
      rotated: false,
      searched: false,
      metadata: { durability: 90, serial: 'P-5500', ammo: 0, components: [] },
    },
    {
      slot: 107,
      name: 'knife',
      weight: 300,
      count: 1,
      gridX: 2,
      gridY: 2,
      rotated: true,
      searched: true,
      metadata: { durability: 80 },
    },
  ],
};

const shopInventory = {
  id: 'shop_weapon',
  type: 'shop',
  slots: 40,
  label: '24/7 Weapon Shop',
  gridWidth: 10,
  gridHeight: 7,
  groups: { police: 0 },
  items: [
    {
      slot: 1,
      name: 'weapon_assaultrifle',
      weight: 4500,
      count: 5,
      price: 35000,
      currency: 'money',
      gridX: 0,
      gridY: 0,
      rotated: false,
    },
    {
      slot: 2,
      name: 'bandage',
      weight: 100,
      count: 50,
      price: 50,
      currency: 'money',
      gridX: 5,
      gridY: 0,
      rotated: false,
    },
    {
      slot: 3,
      name: 'burger',
      weight: 300,
      count: 20,
      price: 25,
      currency: 'money',
      gridX: 6,
      gridY: 0,
      rotated: false,
    },
    {
      slot: 4,
      name: 'weapon_pistol',
      weight: 1500,
      count: 10,
      price: 12500,
      currency: 'money',
      gridX: 7,
      gridY: 0,
      rotated: false,
    },
    {
      slot: 6,
      name: 'ammo_9mm',
      weight: 200,
      count: 999,
      price: 15,
      currency: 'money',
      gridX: 9,
      gridY: 0,
      rotated: false,
    },
    {
      slot: 5,
      name: 'weapon_smg',
      weight: 2800,
      count: 3,
      price: 22000,
      currency: 'money',
      gridX: 5,
      gridY: 1,
      rotated: false,
    },
    {
      slot: 11,
      name: 'lockpick',
      weight: 200,
      count: 0,
      price: 500,
      currency: 'black_money',
      gridX: 8,
      gridY: 1,
      rotated: false,
    },
    {
      slot: 8,
      name: 'knife',
      weight: 300,
      count: 15,
      price: 350,
      currency: 'money',
      gridX: 9,
      gridY: 1,
      rotated: false,
    },
    {
      slot: 7,
      name: 'armour',
      weight: 3500,
      count: 8,
      price: 8500,
      currency: 'money',
      gridX: 0,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 9,
      name: 'medkit',
      weight: 1000,
      count: 12,
      price: 2500,
      currency: 'money',
      gridX: 2,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 10,
      name: 'water',
      weight: 500,
      count: 100,
      price: 10,
      currency: 'money',
      gridX: 4,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 13,
      name: 'phone',
      weight: 200,
      count: 25,
      price: 800,
      currency: 'money',
      gridX: 8,
      gridY: 2,
      rotated: false,
    },
    {
      slot: 12,
      name: 'radio',
      weight: 400,
      count: 7,
      price: 1200,
      currency: 'money',
      gridX: 5,
      gridY: 3,
      rotated: false,
    },
  ],
};

const craftingInventory = {
  id: 'crafting_bench',
  type: 'crafting',
  slots: 20,
  label: 'Crafting Bench',
  gridWidth: 10,
  gridHeight: 7,
  items: [
    {
      slot: 1,
      name: 'medkit',
      weight: 1000,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      ingredients: { bandage: 3, water: 1 },
      duration: 5000,
    },
    {
      slot: 2,
      name: 'bandage',
      weight: 100,
      count: 1,
      gridX: 2,
      gridY: 0,
      rotated: false,
      ingredients: { water: 1 },
      duration: 2000,
    },
    {
      slot: 3,
      name: 'lockpick',
      weight: 200,
      count: 1,
      gridX: 3,
      gridY: 0,
      rotated: false,
      ingredients: { bandage: 2 },
      duration: 3000,
    },
    {
      slot: 4,
      name: 'burger',
      weight: 300,
      count: 1,
      gridX: 4,
      gridY: 0,
      rotated: false,
      ingredients: { water: 1 },
      duration: 1500,
    },
    {
      slot: 5,
      name: 'knife',
      weight: 300,
      count: 1,
      gridX: 5,
      gridY: 0,
      rotated: false,
      ingredients: { lockpick: 3 },
      duration: 8000,
    },
    {
      slot: 6,
      name: 'armour',
      weight: 3500,
      count: 1,
      gridX: 0,
      gridY: 2,
      rotated: false,
      ingredients: { bandage: 5, medkit: 2 },
      duration: 15000,
    },
  ],
};

const trunkInventory = {
  id: 'trunk_ABC123',
  type: 'trunk',
  slots: 40,
  label: 'Vehicle Trunk',
  weight: 3200,
  maxWeight: 30000,
  gridWidth: 8,
  gridHeight: 5,
  searchable: true,
  unsearchedCount: 3,
  items: [
    {
      slot: 1,
      name: 'weapon_pistol',
      weight: 1500,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      searched: true,
      metadata: { durability: 72, serial: 'P-8811', ammo: 6, components: [] },
    },
    {
      slot: 2,
      name: 'medkit',
      weight: 1000,
      count: 1,
      gridX: 2,
      gridY: 0,
      rotated: false,
      searched: false,
      metadata: { durability: 85 },
    },
    {
      slot: 3,
      name: 'water',
      weight: 500,
      count: 2,
      gridX: 4,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 4,
      name: 'bandage',
      weight: 100,
      count: 3,
      gridX: 5,
      gridY: 0,
      rotated: false,
      searched: true,
    },
    {
      slot: 5,
      name: 'ammo_9mm',
      weight: 200,
      count: 45,
      gridX: 6,
      gridY: 0,
      rotated: false,
      searched: false,
    },
  ],
};

const gloveboxInventory = {
  id: 'glovebox_ABC123',
  type: 'glovebox',
  slots: 10,
  label: 'Glovebox',
  weight: 600,
  maxWeight: 5000,
  gridWidth: 5,
  gridHeight: 2,
  searchable: true,
  unsearchedCount: 2,
  items: [
    {
      slot: 1,
      name: 'phone',
      weight: 200,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      searched: true,
    },
    {
      slot: 2,
      name: 'lockpick',
      weight: 200,
      count: 1,
      gridX: 1,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 3,
      name: 'bandage',
      weight: 100,
      count: 2,
      gridX: 2,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 4,
      name: 'water',
      weight: 500,
      count: 1,
      gridX: 3,
      gridY: 0,
      rotated: false,
      searched: true,
    },
  ],
};

const dropInventory = {
  id: 'drop_1',
  type: 'drop',
  slots: 70,
  label: 'Drop',
  weight: 1800,
  maxWeight: 100000,
  gridWidth: 10,
  gridHeight: 7,
  searchable: true,
  unsearchedCount: 3,
  items: [
    {
      slot: 1,
      name: 'weapon_pistol',
      weight: 1500,
      count: 1,
      gridX: 0,
      gridY: 0,
      rotated: false,
      searched: false,
      metadata: { durability: 10, serial: 'P-0001', ammo: 2, components: [] },
    },
    {
      slot: 2,
      name: 'bandage',
      weight: 100,
      count: 1,
      gridX: 2,
      gridY: 0,
      rotated: false,
      searched: false,
    },
    {
      slot: 3,
      name: 'water',
      weight: 500,
      count: 1,
      gridX: 3,
      gridY: 0,
      rotated: false,
      searched: false,
    },
  ],
};

const inventoryPresets: Record<string, any> = {
  stash: stashInventory,
  shop: shopInventory,
  crafting: craftingInventory,
  trunk: trunkInventory,
  drop: dropInventory,
  glovebox: gloveboxInventory,
};

if (isEnvBrowser()) {
  Locale['used'] = 'Used';
  Locale['received'] = 'Received';
  Locale['removed'] = 'Removed';
  Locale['crafted'] = 'Crafted';
  Locale['purchased'] = 'Purchased';
}

const notifyTestItems = [
  { item: { slot: 99, name: 'water', weight: 500, count: 3 }, text: 'received', count: 3 },
  { item: { slot: 99, name: 'bandage', weight: 100, count: 5 }, text: 'used', count: 1 },
  { item: { slot: 99, name: 'medkit', weight: 1000, count: 1, metadata: { durability: 80 } }, text: 'crafted' },
  { item: { slot: 99, name: 'burger', weight: 300, count: 2 }, text: 'purchased', count: 2 },
  { item: { slot: 99, name: 'weapon_pistol', weight: 1500, count: 1, metadata: { durability: 45, serial: 'P-0000' } }, text: 'removed', count: 1 },
  { item: { slot: 99, name: 'ammo_9mm', weight: 200, count: 30 }, text: 'received', count: 30 },
];
let notifyIndex = 0;

debugData([
  {
    action: 'setupInventory',
    data: {
      leftInventory: playerInventory,
      rightInventory: stashInventory,
    },
  },
]);

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const manager = useDragDropManager();
  const [activeView, setActiveView] = useState('stash');

  const switchView = useCallback(
    (view: string) => {
      setActiveView(view);
      dispatch(
        setupInventory({
          leftInventory: JSON.parse(JSON.stringify(playerInventory)),
          rightInventory: JSON.parse(JSON.stringify(inventoryPresets[view])),
        })
      );
    },
    [dispatch]
  );

  useNuiEvent<{
    locale: { [key: string]: string };
    items: typeof Items;
    leftInventory: Inventory;
    imagepath: string;
    componentSizeModifiers?: Record<string, [number, number]>;
    hotbarBindings?: any;
  }>('init', ({ locale, items, leftInventory, imagepath, componentSizeModifiers, hotbarBindings }) => {
    for (const name in locale) Locale[name] = locale[name];
    for (const name in items) Items[name] = items[name];
    if (componentSizeModifiers) {
      for (const type in componentSizeModifiers) {
        const [w, h] = componentSizeModifiers[type];
        COMPONENT_SIZE_MODIFIERS[type] = { width: w, height: h };
      }
    }

    setImagePath(imagepath);
    dispatch(setupInventory({ leftInventory }));

    if (hotbarBindings) {
      try {
        const parsed = typeof hotbarBindings === 'string' ? JSON.parse(hotbarBindings) : hotbarBindings;
        loadBindingsFromServer(parsed);
      } catch {}
    }
    dispatch(restoreHotbar(reconcileHotbar(leftInventory.items)));
  });

  useEffect(() => {
    fetchNui('uiLoaded', {});
  }, []);

  useNuiEvent('closeInventory', () => {
    manager.dispatch({ type: 'dnd-core/END_DRAG' });
  });

  useEffect(() => {
    if (isEnvBrowser()) {
      const timer = setTimeout(() => {
        dispatch(assignHotbar({ hotbarSlot: 0, itemSlot: 3 }));
        dispatch(assignHotbar({ hotbarSlot: 1, itemSlot: 5 }));
        dispatch(assignHotbar({ hotbarSlot: 4, itemSlot: 1 }));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [dispatch]);

  useNuiEvent<number>('useHotbar', (hotbarIndex) => {
    const { inventory: state } = store.getState();
    const slotId = state.hotbar[hotbarIndex - 1];
    if (slotId === null || slotId === undefined) return;
    const item = state.leftInventory.items.find((i) => i != null && i.slot === slotId);
    if (!item || !isSlotWithItem(item)) return;
    fetchNui('useItem', slotId);
  });

  return (
    <div className="app-wrapper">
      <InventoryComponent />
      <GridDragPreview />
      <KeyPress />
      {isEnvBrowser() && (
        <div className="dev-toolbar">
          <span className="dev-toolbar-label">VIEW</span>
          {Object.keys(inventoryPresets).map((view) => (
            <button
              key={view}
              className={`dev-toolbar-btn ${activeView === view ? 'dev-toolbar-btn--active' : ''}`}
              onClick={() => switchView(view)}
            >
              {view}
            </button>
          ))}
          <span className="dev-toolbar-label" style={{ marginLeft: 8 }}>TOOLS</span>
          <button
            className="dev-toolbar-btn"
            onClick={() => window.dispatchEvent(new MessageEvent('message', { data: { action: 'toggleHotbar' } }))}
          >
            hotbar
          </button>
          <button
            className="dev-toolbar-btn"
            onClick={() => {
              const test = notifyTestItems[notifyIndex % notifyTestItems.length];
              notifyIndex++;
              window.dispatchEvent(
                new MessageEvent('message', {
                  data: { action: 'itemNotify', data: [test.item, test.text, test.count] },
                })
              );
            }}
          >
            notify
          </button>
        </div>
      )}
    </div>
  );
};

addEventListener("dragstart", function(event) {
  event.preventDefault()
})

export default App;
