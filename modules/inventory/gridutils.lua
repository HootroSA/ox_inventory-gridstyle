local Items = require 'modules.items.server'

local GridUtils = {}

local ComponentSizeModifiers = (lib.load('data.weapons') or {}).ComponentSizeModifiers or {}

function GridUtils.ComputeWeaponSize(weaponItemData, metadata)
    local w = weaponItemData.width or 1
    local h = weaponItemData.height or 1
    if not metadata or not metadata.components then return w, h end
    for _, compName in ipairs(metadata.components) do
        local compData = Items(compName)
        if compData then
            local mod = compData.sizeModifier or ComponentSizeModifiers[compData.type]
            if mod then
                w = w + (mod[1] or 0)
                h = h + (mod[2] or 0)
            end
        end
    end
    return w, h
end

function GridUtils.BuildOccupancy(inv, excludeSlot)
    local gridWidth = inv.gridWidth or 10
    local gridHeight = inv.gridHeight or 7
    local grid = {}

    for y = 0, gridHeight - 1 do
        grid[y] = {}
        for x = 0, gridWidth - 1 do
            grid[y][x] = false
        end
    end

    if not inv.items then return grid end

    for slot, item in pairs(inv.items) do
        if item and item.name and slot ~= excludeSlot and item.gridX ~= nil then
            local itemData = Items(item.name)
            if itemData then
                local w, h
                if itemData.weapon and item.metadata and item.metadata.components then
                    w, h = GridUtils.ComputeWeaponSize(itemData, item.metadata)
                else
                    w = itemData.width or 1
                    h = itemData.height or 1
                end

                if item.gridRotated then
                    w, h = h, w
                end

                local gx = item.gridX
                local gy = item.gridY or 0

                for dy = 0, h - 1 do
                    for dx = 0, w - 1 do
                        local cx = gx + dx
                        local cy = gy + dy
                        if grid[cy] and grid[cy][cx] ~= nil then
                            grid[cy][cx] = slot
                        end
                    end
                end
            end
        end
    end

    return grid
end

function GridUtils.CanPlace(grid, gridWidth, gridHeight, x, y, w, h)
    if x < 0 or y < 0 or x + w > gridWidth or y + h > gridHeight then
        return false
    end

    for dy = 0, h - 1 do
        for dx = 0, w - 1 do
            if grid[y + dy][x + dx] then
                return false
            end
        end
    end

    return true
end

function GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
    for y = 0, gridHeight - h do
        for x = 0, gridWidth - w do
            if GridUtils.CanPlace(grid, gridWidth, gridHeight, x, y, w, h) then
                return x, y, false
            end
        end
    end

    if w ~= h then
        for y = 0, gridHeight - w do
            for x = 0, gridWidth - h do
                if GridUtils.CanPlace(grid, gridWidth, gridHeight, x, y, h, w) then
                    return x, y, true
                end
            end
        end
    end

    return nil
end

local dimensionDefaults = {
    player = { 10, 7 },
    stash = { 10, 7 },
    trunk = { 8, 5 },
    glovebox = { 5, 2 },
    container = { 4, 3 },
    drop = { 10, 7 },
    newdrop = { 10, 7 },
    dumpster = { 6, 3 },
    policeevidence = { 10, 7 },
    shop = { 10, 7 },
    crafting = { 10, 7 },
}

function GridUtils.GetDimensions(invType, slots)
    local ratio = shared.slotratio or 1
    local cols = shared.gridwidth or 10

    if slots and (invType == 'container' or invType == 'stash' or invType == 'temp' or invType == 'trunk' or invType == 'glovebox') then
        local dims = dimensionDefaults[invType]
        local w = dims and dims[1] or math.min(slots, cols)
        local h = math.ceil(slots / w) * ratio
        return w, h
    end

    local dims = dimensionDefaults[invType]
    if dims then return dims[1], dims[2] end
    return cols, shared.gridheight or 7
end

function GridUtils.IsGridInventory(invType)
    return invType ~= 'shop' and invType ~= 'crafting'
end

return GridUtils
