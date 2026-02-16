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
    weight = 30q00,
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

Vehicle trunks and gloveboxes have their own grid dimensions. The default grid sizes are:

| Type | Width | Height |
|------|-------|--------|
| Trunk | 8 | 5 |
| Glovebox | 5 | 2 |

Vehicle capacity (slots and max weight) is configured per vehicle class in `data/vehicles.lua`. The format is `{slots, maxWeight}`:

```lua
trunk = {
    [0] = {21, 168000},     -- Compacts
    [1] = {41, 328000},     -- Sedans
    [2] = {51, 408000},     -- SUVs
    [3] = {21, 168000},     -- Coupes
    [4] = {21, 168000},     -- Muscle
    [5] = {21, 168000},     -- Sports Classics
    [6] = {21, 168000},     -- Sports
    [7] = {21, 168000},     -- Super
    [9] = {61, 488000},     -- Off-Road
    [12] = {61, 488000},    -- Vans
    -- Per-model overrides:
    models = {
        [`xa21`] = {11, 88000},
    }
},

glovebox = {
    [0] = {11, 88000},      -- Compacts
    [1] = {11, 88000},      -- Sedans
    -- ...
    models = {
        [`xa21`] = {11, 88000},
    }
},
```

To customize the grid dimensions for vehicle inventories, modify the defaults in `modules/inventory/gridutils.lua` and `web/src/helpers/gridConstants.ts`.

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
set inventory:gridwidth 10
set inventory:gridheight 7

# Enable the Tarkov-style search mechanic (default: 0 / off)
# When enabled, items in stashes, trunks, gloveboxes, drops, dumpsters,
# containers, and police evidence must be searched before they are visible
set inventory:searchable 0
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
