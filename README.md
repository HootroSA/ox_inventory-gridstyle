# ox_inventory - Grid Style

> **This project is a work in progress.** Expect bugs and unfinished features. If you encounter any issues, please report them on the [Issues](https://github.com/HootroSA/ox_inventory-gridstyle/issues) tab — do not DM for support.

A 2D spatial grid inventory system for FiveM, inspired by Escape from Tarkov and DayZ. Fork of [CommunityOx/ox_inventory](https://github.com/CommunityOx/ox_inventory).

Items occupy real grid space based on their width and height. Drag, drop, rotate, stack, and swap items in a fully spatial inventory.

## Features

- **2D Spatial Grid** - Items occupy real width x height cells, not just single slots
- **Drag & Drop** - Place items anywhere on the grid with real-time placement preview
- **Item Rotation** - Press `R` while dragging to rotate items 90 degrees
- **Smart Auto-Placement** - Items automatically find the first available position
- **Visual Ghost Overlay** - Green/red placement preview shows valid/invalid positions
- **Stack Splitting** - Right-click to set a split amount, then drag to split stacks
- **Ctrl+Click Fast Move** - Quickly move items between inventories
- **Hotbar** - Hover an item and press 1-5 to assign hotbar slots
- **Grid-Aware Shops & Crafting** - Shop and crafting inventories render as grids with price/recipe info
- **Smooth Animations** - Scale + fade open/close transitions, slide-in for secondary inventories
- **Redesigned Context Menu** - Compact right-click menu with item preview, durability bar, and amount slider
- **Searchable Inventories** - Optional Tarkov-style search mechanic, items appear as "?" until searched
- **Dynamic Weapon Sizing** - Weapons grow on the grid when attachments are added
- **Backpacks** - Wearable containers with their own grid dimensions
- **Full Export Compatibility** - All existing ox_inventory exports work without changes

## Dependencies

- [oxmysql](https://github.com/overextended/oxmysql)
- [ox_lib](https://github.com/overextended/ox_lib)
- OneSync enabled
- Server artifact 6116+

## Supported Frameworks

- [ox_core](https://github.com/communityox/ox_core)
- [esx](https://github.com/esx-framework/esx_core)
- [qbox](https://github.com/Qbox-project/qbx_core)
- [nd_core](https://github.com/ND-Framework/ND_Core)

## Installation

### Using the release (pre-built)

1. Download the latest release from [Releases](https://github.com/HootroSA/ox_inventory-gridstyle/releases)
2. Extract to your resources folder as `ox_inventory`
3. Add `width` and `height` fields to all items in `data/items.lua` (see [Item Sizing](#item-sizing))
4. Add `width` and `height` fields to all weapons in `data/weapons.lua` (see [Weapon Sizing](#weapon-sizing))
5. Add `sizeModifier` to all components in `data/weapons.lua` (see [Attachment Sizing](#attachment-sizing))
6. Configure backpacks in `modules/items/containers.lua` with grid dimensions (see [Backpacks](#backpacks))
7. Add the grid convars to your `server.cfg` (see [Convars](#convars))
8. `ensure ox_inventory` in your server.cfg

### Building from source

1. Clone this repository
2. `cd web && npm install && npm run build`
3. Follow steps 3-8 above

## Item Sizing

Every item in `data/items.lua` requires `width` and `height` fields that define how many grid cells the item occupies. Items without these fields default to 1x1.

```lua
-- Small item (1x1)
['bandage'] = {
    label = 'Bandage',
    weight = 115,
    width = 1,
    height = 1,
},

-- Tall item (1x2)
['mustard'] = {
    label = 'Mustard',
    weight = 500,
    width = 1,
    height = 2,
},

-- Medium item (2x2)
['armour'] = {
    label = 'Bulletproof Vest',
    weight = 3000,
    width = 2,
    height = 2,
    stack = false,
},

-- Large item (2x3)
['parachute'] = {
    label = 'Parachute',
    weight = 8000,
    width = 2,
    height = 3,
    stack = false,
},
```

## Stack Limits

By default, stackable items (`stack = true` or `stack` omitted) can stack infinitely in a single grid cell. You can optionally add a `stackSize` field to limit how many can fit in one stack. When the stack is full, additional items overflow into a new grid cell.

```lua
-- Lockpick: stacks up to 15 per cell
['lockpick'] = {
    label = 'Lockpick',
    weight = 50,
    width = 1,
    height = 1,
    stackSize = 15,
},

-- Bandage: stacks up to 20 per cell
['bandage'] = {
    label = 'Bandage',
    weight = 115,
    width = 1,
    height = 1,
    stackSize = 20,
},

-- Money: no stackSize = unlimited stacking (default behavior)
['money'] = {
    label = 'Money',
    width = 1,
    height = 1,
},

-- Phone: stack = false = no stacking at all
['phone'] = {
    label = 'Phone',
    weight = 190,
    width = 1,
    height = 1,
    stack = false,
},
```

| Configuration | Behavior |
|---------------|----------|
| `stack` omitted, no `stackSize` | Unlimited stacking (default) |
| `stack = true`, no `stackSize` | Unlimited stacking |
| `stack = true`, `stackSize = 15` | Max 15 per slot, overflow to new slot |
| `stack = false` | No stacking, each item gets its own slot |

When a stack limit is set, the inventory displays the current count and max (e.g., `12/15`) instead of just `12x`.

## Item Rarity

Items can have a rarity tier that adds visual indicators — a gradient overlay, rarity-colored hover glow, and a colored accent in the tooltip. Legendary items also get a subtle animated shimmer effect.

### Setting rarity in the item definition

Add a `rarity` field to any item in `data/items.lua`:

```lua
['armour'] = {
    label = 'Bulletproof Vest',
    weight = 3000,
    width = 2,
    height = 2,
    stack = false,
    rarity = 'rare',
},

},
```
Add a `rarity` field to any item in `data/weapons.lua`:

```lua
['weapon_assaultrifle_mk2'] = {
    label = 'Assault Rifle Mk II',
    weight = 4500,
    width = 5,
    height = 2,
    rarity = 'legendary',
},
```

### Rarity tiers

| Tier | Color | 
|------|-------|
| `common` | Green | 
| `uncommon` | Lime | 
| `rare` | Blue | 
| `epic` | Purple |
| `legendary` | Gold | 

Items without a `rarity` field have no rarity styling (default appearance). The rarity is also displayed in the item tooltip.

## Weapon Sizing

Weapons in `data/weapons.lua` also require `width` and `height`. Weapons are typically wider than regular items and their size grows dynamically when attachments are added.

```lua
-- Pistol (2x1)
['WEAPON_PISTOL'] = {
    label = 'Pistol',
    weight = 1130,
    width = 2,
    height = 1,
    durability = 0.1,
    ammoname = 'ammo-9',
},

-- SMG (3x2)
['WEAPON_SMG'] = {
    label = 'SMG',
    weight = 3084,
    width = 3,
    height = 2,
    durability = 0.8,
    ammoname = 'ammo-9',
},

-- Assault Rifle (4x2)
['WEAPON_ASSAULTRIFLE'] = {
    label = 'Assault Rifle',
    weight = 4500,
    width = 4,
    height = 2,
    durability = 0.03,
    ammoname = 'ammo-rifle2',
},

-- Heavy Sniper (6x2)
['WEAPON_HEAVYSNIPER'] = {
    label = 'Heavy Sniper',
    weight = 12700,
    width = 6,
    height = 2,
    durability = 0.5,
    ammoname = 'ammo-heavysniper',
},
```

## Attachment Sizing

Weapon components in `data/weapons.lua` use a `sizeModifier` field that defines how much the weapon's grid size changes when the attachment is equipped. The format is `{width_change, height_change}`.

For example, a suppressor adds 1 to width, an extended magazine adds 1 to height, and a flashlight adds nothing.

```lua
-- Suppressor: adds 1 width to the weapon when attached
['at_suppressor_light'] = {
    label = 'Suppressor',
    weight = 280,
    width = 2,
    height = 1,
    type = 'muzzle',
    sizeModifier = {1, 0},
},

-- Extended Clip: adds 1 height to the weapon when attached
['at_clip_extended_pistol'] = {
    label = 'Extended Pistol Clip',
    weight = 280,
    width = 1,
    height = 1,
    type = 'magazine',
    sizeModifier = {0, 1},
},

-- Flashlight: no size change
['at_flashlight'] = {
    label = 'Tactical Flashlight',
    weight = 120,
    width = 1,
    height = 1,
    type = 'flashlight',
    sizeModifier = {0, 0},
},
```

If a component doesn't have a `sizeModifier`, fallback defaults are used based on the component `type`:

| Type | Width | Height |
|------|-------|--------|
| muzzle | +1 | +0 |
| barrel | +1 | +0 |
| sight | +0 | +1 |
| magazine | +0 | +1 |
| grip | +0 | +0 |
| flashlight | +0 | +0 |
| skin | +0 | +0 |

A pistol (2x1) with a suppressor (+1,0) and extended mag (+0,+1) becomes 3x2 on the grid.

## Backpacks

Backpacks are wearable containers with their own inventory grid. They require two things:

### 1. Item definition in `data/items.lua`

The `width` and `height` here define the backpack's size **in the player's inventory** (how much space it takes up when stored):

```lua
['backpack_small'] = {
    label = 'Small Backpack',
    weight = 500,
    width = 2,
    height = 2,
    stack = false,
    close = false,
    consume = 0,
},

['backpack_medium'] = {
    label = 'Medium Backpack',
    weight = 800,
    width = 2,
    height = 3,
    stack = false,
    close = false,
    consume = 0,
},

['backpack_large'] = {
    label = 'Large Backpack',
    weight = 1200,
    width = 3,
    height = 3,
    stack = false,
    close = false,
    consume = 0,
},
```

### 2. Container properties in `modules/items/containers.lua`

The `gridWidth` and `gridHeight` here define the backpack's **internal grid** (how much space it has inside):

```lua
setBackpackProperties('backpack_small', {
    slots = 10,
    maxWeight = 5000,
    gridWidth = 5,
    gridHeight = 3,
})

setBackpackProperties('backpack_medium', {
    slots = 20,
    maxWeight = 15000,
    gridWidth = 6,
    gridHeight = 4,
})

setBackpackProperties('backpack_large', {
    slots = 30,
    maxWeight = 30000,
    gridWidth = 8,
    gridHeight = 5,
})
```

To create a new backpack, add both the item definition and the container properties, then add an image to `web/images/`.

## Vehicle Inventories

Vehicle trunks and gloveboxes are configured in `data/vehicles.lua` using `gridWidth`, `gridHeight`, and `maxWeight`. The grid dimensions directly control how big the inventory is — slots are derived automatically (`slots = gridWidth * gridHeight`).

### Three-tier priority

Vehicle storage uses a three-tier lookup: **per-model > per-class > fallback defaults**. This means you can set defaults for all sedans, then override a specific vehicle model if needed.

### Configuration format

Each vehicle class (0–20) gets a `{ gridWidth, gridHeight, maxWeight }` entry. Per-model overrides go in the `models` sub-table.

```lua
-- data/vehicles.lua
trunk = {
    -- Per vehicle class (GTA class IDs)
    [0]  = { gridWidth = 6, gridHeight = 3, maxWeight = 168000 },   -- Compact
    [1]  = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },   -- Sedan
    [2]  = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },   -- SUV
    [3]  = { gridWidth = 6, gridHeight = 4, maxWeight = 248000 },   -- Coupe
    [4]  = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },   -- Muscle
    [5]  = { gridWidth = 6, gridHeight = 3, maxWeight = 248000 },   -- Sports Classic
    [6]  = { gridWidth = 6, gridHeight = 3, maxWeight = 248000 },   -- Sports
    [7]  = { gridWidth = 5, gridHeight = 2, maxWeight = 168000 },   -- Super
    [8]  = { gridWidth = 3, gridHeight = 1, maxWeight = 40000 },    -- Motorcycle
    [9]  = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },   -- Offroad
    [10] = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },   -- Industrial
    [11] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },   -- Utility
    [12] = { gridWidth = 9, gridHeight = 6, maxWeight = 488000 },   -- Van
    [17] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },   -- Service
    [18] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },   -- Emergency
    [19] = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },   -- Military
    [20] = { gridWidth = 10, gridHeight = 6, maxWeight = 488000 },  -- Commercial

    -- Per-model overrides (takes priority over class)
    models = {
        [`xa21`] = { gridWidth = 4, gridHeight = 2, maxWeight = 10000 },
        [`sultan`] = { gridWidth = 5, gridHeight = 5, maxWeight = 88000 },
    },
},

glovebox = {
    [0]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },    -- Compact
    [1]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },    -- Sedan
    [2]  = { gridWidth = 5, gridHeight = 2, maxWeight = 88000 },    -- SUV
    -- ... other classes ...

    models = {
        [`xa21`] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },
    },
},
```

### How it works

1. When a player opens a trunk or glovebox, the system looks up the vehicle's spawn name (model) first
2. If there's a match in `models`, those dimensions are used
3. Otherwise it falls back to the vehicle's GTA class ID (0–20)
4. Slots are calculated as `gridWidth * gridHeight` — you never need to set slots manually

### Vehicle class IDs

| ID | Class | ID | Class |
|----|-------|----|-------|
| 0 | Compact | 10 | Industrial |
| 1 | Sedan | 11 | Utility |
| 2 | SUV | 12 | Van |
| 3 | Coupe | 14 | Boat |
| 4 | Muscle | 15 | Helicopter |
| 5 | Sports Classic | 16 | Plane |
| 6 | Sports | 17 | Service |
| 7 | Super | 18 | Emergency |
| 8 | Motorcycle | 19 | Military |
| 9 | Offroad | 20 | Commercial |

### Storage flags

The `Storage` table at the top of `data/vehicles.lua` controls special cases:

```lua
Storage = {
    [`jester`] = 3,   -- 3 = trunk in the hood (front engine)
    [`osiris`] = 1,    -- 1 = no trunk
    [`pfister811`] = 1,
    -- 0 = no storage at all
    -- 2 = no glovebox
}
```

## Default Grid Dimensions

Every inventory type has a default grid size. These are defined in `modules/inventory/gridutils.lua` and `web/src/helpers/gridConstants.ts`:

| Inventory Type | Width | Height |
|----------------|-------|--------|
| Player | 10 | 7 |
| Stash | 10 | 7 |
| Trunk | 8 | 5 |
| Glovebox | 5 | 2 |
| Container | 4 | 3 |
| Backpack | 5 | 4 |
| Drop | 10 | 7 |
| Dumpster | 6 | 3 |
| Police Evidence | 10 | 7 |
| Shop | 10 | 7 |
| Crafting | 10 | 7 |

The player inventory grid dimensions can be overridden via convars (see below). Other types are changed by editing the defaults in the files above.

## Convars

Add these to your `server.cfg` **before** `ensure ox_inventory`.

### Grid Convars

```cfg
# Player inventory grid size (default: 10 wide, 7 tall)
setr inventory:gridwidth 10
setr inventory:gridheight 7

# Slot-to-grid ratio for containers (default: 1 = 1 row per slot row)
# How many grid rows each row of container slots gets.
# Slots fill left to right using gridwidth, then wrap to the next row.
# Example with gridwidth 10, slotratio 1: 23 slots → 10x3
# Example with gridwidth 10, slotratio 2: 23 slots → 10x6
setr inventory:slotratio 1

# Enable the Tarkov-style search mechanic (default: 0 / off)
# When enabled, items in stashes, trunks, gloveboxes, drops, dumpsters,
# containers, and police evidence must be searched before they are visible
setr inventory:searchable 0
```

## Searchable Inventories

When `inventory:searchable` is set to `1`, items inside certain inventory types appear as mystery "?" cells until the player searches them by clicking on each item.

**How it works:**
- Each unsearched item shows as a blurred "?" cell — you can see the item's size but not what it is
- Click an unsearched item to search it (1.5s spinner animation, then the item is revealed)
- Multiple items can be searched simultaneously
- All interactions (drag, context menu, tooltip, swap, stack) are blocked on unsearched items
- Search progress is saved per-player using FiveM KVP (no database needed)
- Only new items need searching — previously searched items stay visible on future opens

**Searchable inventory types:** stash, trunk, glovebox, drop, dumpster, container, police evidence, other players (frisking/stealing)

**Never searchable:** your own inventory, shops, crafting, backpacks

The searchable types can be customized in `client.lua` by editing the `searchableTypes` table.

## Controls

| Action | Control |
|--------|---------|
| Drag item | Left-click + drag |
| Rotate while dragging | `R` |
| Fast move to other inventory | `Ctrl` + click |
| Use item | `Alt` + click or double-click |
| Context menu (player items) | Right-click |
| Split stack | Right-click > set amount > drag |
| Assign hotbar | Hover + press `1`-`5` |
| Search item (when searchable) | Left-click on "?" item |

## Copyright

Copyright (c) 2024 Overextended <https://github.com/overextended>

Grid system modifications by HootroSA.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
