if not lib then return end

local Inventory = {}
local GridUtils = require 'modules.inventory.gridutils'

---@type table<any, OxInventory>
local Inventories = {}

---@class OxInventory
local OxInventory = {}
OxInventory.__index = OxInventory

---Open a player's inventory, optionally with a secondary inventory.
---@param inv? inventory
function OxInventory:openInventory(inv)
	if not self?.player then return end

	inv = Inventory(inv)

	if not inv then return end

	inv:set('open', true)
	inv.openedBy[self.id] = true
	self.open = inv.id

	TriggerEvent('ox_inventory:openedInventory', self.id, inv.id)
end

---Close a player's inventory.
---@param noEvent? boolean
---@param keepBackpack? boolean If true, preserve the open backpack (used when switching right inventories).
function OxInventory:closeInventory(noEvent, keepBackpack)
	if not self.player then return end

	if not keepBackpack and self.openBackpack then
		local backpack = Inventory(self.openBackpack)

		if backpack then
			if backpack.openedBy then backpack.openedBy[self.id] = nil end

			if backpack.changed then
				Inventory.Save(backpack)
			end
		end

		self.openBackpack = nil
		self.backpackSlot = nil
	end

	if not self.open then return end

	local inv = Inventory(self.open)

	if not inv then return end

	inv.openedBy[self.id] = nil
	inv:set('open', false)
	self.open = false
	self.currentShop = nil
	self.containerSlot = nil

	if not noEvent then
		TriggerClientEvent('ox_inventory:closeInventory', self.id, true)
	end

	TriggerEvent('ox_inventory:closedInventory', self.id, inv.id)
end

---@alias updateSlot { item: SlotWithItem | { slot: number }, inventory: string|number }

---Sync a player's inventory state.
---@param slots updateSlot[]
---@param weight { left?: number, right?: number } | number
function OxInventory:syncSlotsWithPlayer(slots, weight)
	TriggerClientEvent('ox_inventory:updateSlots', self.id, slots, weight)
end

---Sync an inventory's state with all player's accessing it.
---@param slots updateSlot[]
---@param syncOwner? boolean
function OxInventory:syncSlotsWithClients(slots, syncOwner)
	for playerId in pairs(self.openedBy) do
		if self.id ~= playerId then
            local target = Inventories[playerId]

            if target then
			    TriggerClientEvent('ox_inventory:updateSlots', playerId, slots, target.weight)
            end
		end
	end

	if syncOwner and self.player then
		TriggerClientEvent('ox_inventory:updateSlots', self.id, slots, self.weight)
	end
end

local Vehicles = lib.load('data.vehicles')
local RegisteredStashes = {}

for _, stash in pairs(lib.load('data.stashes') or {}) do
	RegisteredStashes[stash.name] = {
		name = stash.name,
		label = stash.label,
		owner = stash.owner,
		slots = stash.slots,
		maxWeight = stash.weight,
		groups = stash.groups or stash.jobs,
		coords = shared.target and stash.target?.loc or stash.coords,
        distance = stash.distance or 10
	}
end

local GetVehicleNumberPlateText = GetVehicleNumberPlateText

---Atempts to lazily load inventory data from the database or create a new player-owned instance for "personal" stashes
---@param data table
---@param player table
---@param ignoreSecurityChecks boolean
---@return OxInventory | false | nil
local function loadInventoryData(data, player, ignoreSecurityChecks)
	local source = source
	local inventory

	if not data.type and type(data.id) == 'string' then
		if data.id:find('^glove') then
			data.type = 'glovebox'
		elseif data.id:find('^trunk') then
			data.type = 'trunk'
		elseif data.id:find('^evidence-') then
			data.type = 'policeevidence'
		end
	end

	if data.type == 'trunk' or data.type == 'glovebox' then
		local plate = data.id:sub(6)

		if server.trimplate then
			plate = string.strtrim(plate)
			data.id = ('%s%s'):format(data.id:sub(1, 5), plate)
		end

		inventory = Inventories[data.id]

		if not inventory then
			local entity

			if data.netid then
				entity = NetworkGetEntityFromNetworkId(data.netid)

				if not entity then
					return shared.info('Failed to load vehicle inventory data (no entity exists with given netid).')
				end

                data.entityId = entity
			else
				local vehicles = GetAllVehicles()

				for i = 1, #vehicles do
					local vehicle = vehicles[i]
					local _plate = GetVehicleNumberPlateText(vehicle)

					if _plate:find(plate) then
						entity = vehicle
                        data.entityId = entity
						data.netid = NetworkGetNetworkIdFromEntity(entity)
						break
					end
				end

				if not entity then
					return shared.info('Failed to load vehicle inventory data (no entity exists with given plate).')
				end
			end

			if not source then
				source = NetworkGetEntityOwner(entity)

				if not source then
					return shared.info('Failed to load vehicle inventory data (entity is unowned).')
				end
			end

			local model, class = lib.callback.await('ox_inventory:getVehicleData', source, data.netid)
			local storage = Vehicles[data.type].models[model] or Vehicles[data.type][class]
            local dbId

            if server.getOwnedVehicleId then
                dbId = server.getOwnedVehicleId(entity)
            else
                dbId = data.id:sub(6)
            end

            local slots = storage.gridWidth * storage.gridHeight
            inventory = Inventory.Create(data.id, plate, data.type, slots, 0, storage.maxWeight, false, nil, nil, dbId)

			if inventory then
				inventory.gridWidth = storage.gridWidth
				inventory.gridHeight = storage.gridHeight
			end
		end
	elseif data.type == 'policeevidence' then
		inventory = Inventory.Create(data.id, locale('police_evidence'), data.type, 100, 0, 100000, false)
	else
		local stash = RegisteredStashes[data.id]

		if stash then
			if stash.jobs then stash.groups = stash.jobs end
			if not ignoreSecurityChecks and player and stash.groups and not server.hasGroup(player, stash.groups) then return end

			local owner

			if stash.owner then
				if stash.owner == true then
					owner = data.owner or player?.owner
				else
					owner = stash.owner
				end
			end

			inventory = Inventories[owner and ('%s:%s'):format(stash.name, owner) or stash.name]

			if not inventory then
				inventory = Inventory.Create(stash.name, stash.label or stash.name, 'stash', stash.slots, 0, stash.maxWeight, owner, nil, stash.groups)
                inventory.coords = stash.coords
                inventory.distance = stash.distance
			end
		end
	end

	if data.netid then
        inventory.entityId = data.entityId or NetworkGetEntityFromNetworkId(data.netid)
		inventory.netid = data.netid
	end

	return inventory or false
end

setmetatable(Inventory, {
	__call = function(self, inv, player, ignoreSecurityChecks)
        if Inventory.Lock then return false end

		if not inv then
			return self
		elseif type(inv) == 'table' then
			if inv.__index then return inv end

			return not inv.owner and Inventories[inv.id] or loadInventoryData(inv, player, ignoreSecurityChecks)
		end

		return Inventories[inv] or loadInventoryData({ id = inv }, player, ignoreSecurityChecks)
	end
})

---@cast Inventory +fun(inv: inventory, player?: inventory, ignoreSecurityChecks?: boolean): OxInventory|false|nil

---@param inv inventory
---@param owner? string | number
local function getInventory(inv, owner)
	if not inv then return Inventory end

	local type = type(inv)

	if type == 'table' or type == 'number' then
		return Inventory(inv)
	else
		return Inventory({ id = inv, owner = owner })
	end
end

exports('Inventory', getInventory)
exports('GetInventory', getInventory)

---@param inv inventory
---@param owner? string | number
---@return table?
exports('GetInventoryItems', function(inv, owner)
	return getInventory(inv, owner)?.items
end)

---@param inv inventory
---@param slotId number
---@return OxInventory?
function Inventory.GetContainerFromSlot(inv, slotId)
	local inventory = Inventory(inv)
	local slotData = inventory and inventory.items[slotId]

	if not slotData then return end

	local container = Inventory(slotData.metadata.container)

	if not container then
		container = Inventory.Create(slotData.metadata.container, slotData.label, 'container', slotData.metadata.size[1], 0, slotData.metadata.size[2], false)
	end

	return container
end

exports('GetContainerFromSlot', Inventory.GetContainerFromSlot)

---@param inv? inventory
---@param ignoreId? number|false
function Inventory.CloseAll(inv, ignoreId)
	if not inv then
		for _, data in pairs(Inventories) do
			for playerId in pairs(data.openedBy) do
				local playerInv = Inventory(playerId)

				if playerInv then playerInv:closeInventory(true) end
			end
		end

		return TriggerClientEvent('ox_inventory:closeInventory', -1, true)
	end

	inv = Inventory(inv)

	if not inv then return end

	for playerId in pairs(inv.openedBy) do
		local playerInv = Inventory(playerId)

		if playerInv and playerId ~= ignoreId then
            playerInv:closeInventory()
        end
	end
end

---@param inv inventory
---@param k string
---@param v any
function Inventory.Set(inv, k, v)
	inv = Inventory(inv)

	if inv then
		if type(v) == 'number' then
			v = math.floor(v + 0.5)
		end

		if k == 'open' and v == false then
			if inv.type ~= 'player' then
				if inv.player then
					inv.type = 'player'
				elseif inv.type == 'drop' and not next(inv.items) and not next(inv.openedBy) then
					return Inventory.Remove(inv)
				else
					inv.time = os.time()
				end
			end

			if inv.player then
				inv.containerSlot = nil
			end
		elseif k == 'maxWeight' and v < 1000 then
			v *= 1000
		end

		inv[k] = v
	end
end

---@param inv inventory
---@param key string
function Inventory.Get(inv, key)
	inv = Inventory(inv)
	if inv then
		return inv[key]
	end
end

---@class MinimalInventorySlot
---@field name string
---@field count number
---@field slot number
---@field metadata? table

---@param inv inventory
---@return MinimalInventorySlot[] items
local function minimal(inv)
	inv = Inventory(inv)
	local inventory, count = {}, 0
	for k, v in pairs(inv.items) do
		if v.name and v.count > 0 then
			count += 1
			inventory[count] = {
				name = v.name,
				count = v.count,
				slot = k,
				metadata = next(v.metadata) and v.metadata or nil,
				gridX = v.gridX,
				gridY = v.gridY,
				gridRotated = v.gridRotated,
			}
		end
	end
	return inventory
end

---@param inv inventory
---@param item table
---@param count number
---@param metadata any
---@param slot any
function Inventory.SetSlot(inv, item, count, metadata, slot, skipGridPlacement)
	inv = Inventory(inv)

	if not inv then return end
	if not slot then print('[ox_inventory] SetSlot called with nil slot') return end

	local currentSlot = inv.items[slot]
	local newCount = currentSlot and currentSlot.count + count or count
	local newWeight = currentSlot and inv.weight - currentSlot.weight or inv.weight

	if currentSlot and newCount < 1 then
		TriggerClientEvent('ox_inventory:itemNotify', inv.id, { currentSlot, 'ui_removed', currentSlot.count })
		currentSlot = nil
	else
		local prevGridX = currentSlot and currentSlot.gridX
		local prevGridY = currentSlot and currentSlot.gridY
		local prevGridRotated = currentSlot and currentSlot.gridRotated
		currentSlot = {name = item.name, label = item.label, weight = item.weight, slot = slot, count = newCount, description = item.description, metadata = metadata, stack = item.stack, close = item.close, stackSize = item.stackSize, gridX = prevGridX, gridY = prevGridY, gridRotated = prevGridRotated}
		local slotWeight = Inventory.SlotWeight(item, currentSlot)
		currentSlot.weight = slotWeight
		newWeight += slotWeight

		TriggerClientEvent('ox_inventory:itemNotify', inv.id, { currentSlot, count < 0 and 'ui_removed' or 'ui_added', math.abs(count) })
	end

	if not skipGridPlacement and currentSlot and not currentSlot.gridX and GridUtils.IsGridInventory(inv.type) then
		local gridWidth = inv.gridWidth or shared.gridwidth or 12
		local gridHeight = inv.gridHeight or shared.gridheight or 5
		local grid = GridUtils.BuildOccupancy(inv, slot)
		local w, h
		if item.weapon and currentSlot.metadata and currentSlot.metadata.components then
			w, h = GridUtils.ComputeWeaponSize(item, currentSlot.metadata)
		else
			w = item.width or 1
			h = item.height or 1
		end
		local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
		if gx then
			currentSlot.gridX = gx
			currentSlot.gridY = gy
			currentSlot.gridRotated = rotated or false
		end
	end

	inv.weight = newWeight
	inv.items[slot] = currentSlot
	inv.changed = true

	return currentSlot
end

local Items = require 'modules.items.server'

CreateThread(function()
    Inventory.accounts = server.accounts
    TriggerEvent('ox_inventory:loadInventory', Inventory)
end)

function Inventory.GetAccountItemCounts(inv)
    inv = Inventory(inv)

    if not inv then return end

    local accounts = table.clone(server.accounts)

	for _, v in pairs(inv.items) do
		if accounts[v.name] then
			accounts[v.name] += v.count
		end
	end

    return accounts
end

---@param item table
---@param slot table
function Inventory.SlotWeight(item, slot, ignoreCount)
	local weight = ignoreCount and item.weight or item.weight * (slot.count or 1)

	if not slot.metadata then slot.metadata = {} end

	if item.ammoname and slot.metadata.ammo then
		local ammoWeight = Items(item.ammoname)?.weight

		if ammoWeight then
			weight += (ammoWeight * slot.metadata.ammo)
		end
	end

    if item.hash == `WEAPON_PETROLCAN` then
        slot.metadata.weight = 15000 * (slot.metadata.ammo / 100)
    end

	if slot.metadata.components then
		for i = #slot.metadata.components, 1, -1 do
			local componentWeight = Items(slot.metadata.components[i])?.weight

			if componentWeight then
				weight += componentWeight
			end
		end
	end

	if slot.metadata.weight then
		weight += ignoreCount and slot.metadata.weight or (slot.metadata.weight * (slot.count or 1))
	end

	return weight
end

---@param items table
function Inventory.CalculateWeight(items)
	local weight = 0
	for _, v in pairs(items) do
		local item = Items(v.name)
		if item then
			weight = weight + Inventory.SlotWeight(item, v)
		end
	end
	return weight
end

-- This should be handled by frameworks, but sometimes isn't or is exploitable in some way.
local activeIdentifiers = {}

local function hasActiveInventory(playerId, owner)
	local activePlayer = activeIdentifiers[owner]

	if activePlayer then
        if activePlayer == playerId then
            error('attempted to load active player\'s inventory a secondary time', 0)
        end

		local inventory = Inventory(activePlayer)

		if inventory then
			local endpoint = GetPlayerEndpoint(activePlayer)

			if endpoint then
				DropPlayer(playerId, ("Character identifier '%s' is already active."):format(owner))

                -- Supposedly still getting stuck? Print info and hope somebody reports back (lol)
				print(('kicked player.%s (charid is already in use)'):format(playerId), json.encode({
					oldId = activePlayer,
					newId = playerId,
					charid = owner,
					endpoint = endpoint,
					playerName = GetPlayerName(activePlayer),
					fivem = GetPlayerIdentifierByType(activePlayer, 'fivem'),
					license = GetPlayerIdentifierByType(activePlayer, 'license2') or GetPlayerIdentifierByType(activePlayer, 'license'),
				}, {
					indent = true,
                    sort_keys = true
				}))

				return true
			end

			Inventory.CloseAll(inventory)
			db.savePlayer(owner, json.encode(inventory:minimal()))
			Inventory.Remove(inventory)
			Wait(100)
		end
	end

	activeIdentifiers[owner] = playerId
end

---Manually clear an inventory state tied to the given identifier.
---Temporary workaround until somebody actually gives me info.
RegisterCommand('clearActiveIdentifier', function(source, args)
    ---Server console only.
    if source ~= 0 then return end

	local activePlayer = activeIdentifiers[args[1]] or activeIdentifiers[tonumber(args[1])]
    local inventory = activePlayer and Inventory(activePlayer)

    if not inventory then return end

    local endpoint = GetPlayerEndpoint(activePlayer)

    if endpoint then
        DropPlayer(activePlayer, 'Kicked')

        -- Supposedly still getting stuck? Print info and hope somebody reports back (lol)
        print(('kicked player.%s (clearActiveIdentifier)'):format(activePlayer), json.encode({
            oldId = activePlayer,
            charid = inventory.owner,
            endpoint = endpoint,
            playerName = GetPlayerName(activePlayer),
            fivem = GetPlayerIdentifierByType(activePlayer, 'fivem'),
            license = GetPlayerIdentifierByType(activePlayer, 'license2') or GetPlayerIdentifierByType(activePlayer, 'license'),
        }, {
            indent = true,
            sort_keys = true
        }))
    end

    Inventory.CloseAll(inventory)
    db.savePlayer(inventory.owner, json.encode(inventory:minimal()))
    Inventory.Remove(inventory)
end, true)

---@param id string|number
---@param label string|nil
---@param invType string
---@param slots number
---@param weight number
---@param maxWeight number
---@param owner string | number | boolean
---@param items? table
---@param dbId? string | number
---@return OxInventory?
--- This should only be utilised internally!
--- To create a stash, please use `exports.ox_inventory:RegisterStash` instead.
function Inventory.Create(id, label, invType, slots, weight, maxWeight, owner, items, groups, dbId)
	if invType == 'player' and hasActiveInventory(id, owner) then return end

	local gridWidth, gridHeight = GridUtils.GetDimensions(invType, slots)

	local self = {
		id = id,
		label = label or id,
		type = invType,
		slots = slots,
		weight = weight,
		maxWeight = maxWeight or shared.playerweight,
		owner = owner,
		items = type(items) == 'table' and items,
		open = false,
		set = Inventory.Set,
		get = Inventory.Get,
		minimal = minimal,
		time = os.time(),
		groups = groups,
		openedBy = {},
        dbId = dbId,
		gridWidth = gridWidth,
		gridHeight = gridHeight,
	}

	if invType == 'drop' or invType == 'temp' or invType == 'dumpster' then
		self.datastore = true
	else
		self.changed = false

		if invType ~= 'glovebox' and invType ~= 'trunk' then
			self.dbId = id

			if invType ~= 'player' and owner and type(owner) ~= 'boolean' then
				self.id = ('%s:%s'):format(self.id, owner)
			end
		end
	end

	if not items then
		self.items, self.weight = Inventory.Load(self.dbId, invType, owner)
	elseif weight == 0 and next(items) then
		self.weight = Inventory.CalculateWeight(items)
	end

	if items and GridUtils.IsGridInventory(invType) then
		local needsPlacement = false
		for _, v in pairs(items) do
			if v and v.name and v.gridX == nil then
				needsPlacement = true
				break
			end
		end

		if needsPlacement then
			local positioned = {}
			for slot, v in pairs(items) do
				if v and v.name and v.gridX ~= nil then
					positioned[slot] = v
				end
			end
			local grid = GridUtils.BuildOccupancy({items = positioned, gridWidth = gridWidth, gridHeight = gridHeight})

			for slot, v in pairs(items) do
				if v and v.name and v.gridX == nil then
					local itemData = Items(v.name)
					local w = itemData and itemData.width or 1
					local h = itemData and itemData.height or 1
					local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)

					if gx then
						v.gridX = gx
						v.gridY = gy
						v.gridRotated = rotated or false

						local ew, eh = w, h
						if rotated then ew, eh = eh, ew end
						for dy = 0, eh - 1 do
							for dx = 0, ew - 1 do
								if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
									grid[gy + dy][gx + dx] = slot
								end
							end
						end
					else
						v.gridX = 0
						v.gridY = 0
						v.gridRotated = false
					end
				end
			end

			self.changed = true
		end
	end

	Inventories[self.id] = setmetatable(self, OxInventory)
	return Inventories[self.id]
end

---@param inv inventory
function Inventory.Remove(inv)
	inv = Inventory(inv)

	if not inv then return end

    if inv.type == 'drop' then
        TriggerClientEvent('ox_inventory:removeDrop', -1, inv.id)
        Inventory.Drops[inv.id] = nil
    elseif inv.player then
        activeIdentifiers[inv.owner] = nil
    end

    for playerId in pairs(inv.openedBy) do
        if inv.id ~= playerId then
            local target = Inventories[playerId]

            if target then
                target:closeInventory()
            end
        end
    end

    if not inv.datastore and inv.changed then
        Inventory.Save(inv)
    end

    Inventories[inv.id] = nil
end

exports('RemoveInventory', Inventory.Remove)

---Update the internal reference to vehicle stashes. Does not trigger a save or update the database.
---@param oldPlate string
---@param newPlate string
function Inventory.UpdateVehicle(oldPlate, newPlate)
	oldPlate = oldPlate:upper()
	newPlate = newPlate:upper()

	if server.trimplate then
		oldPlate = string.strtrim(oldPlate)
		newPlate = string.strtrim(newPlate)
	end

	local trunk = Inventory(('trunk%s'):format(oldPlate))
	local glove = Inventory(('glove%s'):format(oldPlate))

	if trunk then
		Inventory.CloseAll(trunk)

		Inventories[trunk.id] = nil
		trunk.label = newPlate
		trunk.dbId = type(trunk.id) == 'number' and trunk.dbId or newPlate
		trunk.id = ('trunk%s'):format(newPlate)
		Inventories[trunk.id] = trunk
	end

	if glove then
		Inventory.CloseAll(glove)

		Inventories[glove.id] = nil
		glove.label = newPlate
		glove.dbId = type(glove.id) == 'number' and glove.dbId or newPlate
		glove.id = ('glove%s'):format(newPlate)
		Inventories[glove.id] = glove
	end
end

exports('UpdateVehicle', Inventory.UpdateVehicle)

function Inventory.Save(inv)
	inv = Inventory(inv)

	if not inv or inv.datastore then return end

    local buffer, n = {}, 0

    for k, v in pairs(inv.items) do
        if not Items.UpdateDurability(inv, v, Items(v.name), nil, os.time()) then
            n += 1
            buffer[n] = {
                name = v.name,
                count = v.count,
                slot = k,
                metadata = next(v.metadata) and v.metadata or nil,
                gridX = v.gridX,
                gridY = v.gridY,
                gridRotated = v.gridRotated,
            }
        end
    end

    local data = next(buffer) and json.encode(buffer) or nil
    inv.changed = false

    if inv.player then
        return shared.framework ~= 'esx' and db.savePlayer(inv.owner, data)
    elseif inv.type == 'trunk' then
        return db.saveTrunk(inv.dbId, data)
    elseif inv.type == 'glovebox' then
        return db.saveGlovebox(inv.dbId, data)
    end

    return db.saveStash(inv.owner, inv.dbId, data)
end

---@alias RandomLoot { [1]: string, [2]: number, [3]: number, [4]?: number }

---@param loot RandomLoot[]
---@param items RandomLoot[]
---@param size number
---@return RandomLoot
local function randomItem(loot, items, size)
    local itemIndex = math.random(1, size)
    local selectedItem = nil

    for _ = 1, size do
        selectedItem = loot[itemIndex]
        local found = false

        for i = 1, #items do
            if items[i][1] == selectedItem[1] then
                found = true
                break
            end
        end

        if not found then break end

        itemIndex = ((itemIndex - 1) % size) + 1
    end

    return selectedItem
end

---@param loot RandomLoot[]
---@return RandomLoot[]
local function randomLoot(loot)
    ---@type RandomLoot[]
    local items = {}
    local size = #loot
    local itemCount = math.random(0, 3)

    for _ = 1, itemCount do
        if #items >= size then break end

        local item = randomItem(loot, items, size)

        if item and math.random(1, 100) <= (item[4] or 80) then
            local count = math.random(item[2], item[3])

            if count > 0 then
                items[#items + 1] = { item[1], count }
            end
        end
    end

    return items
end

---@param inv inventory
---@param invType string
---@param items? table
---@return table returnData, number totalWeight
local function generateItems(inv, invType, items)
	if items == nil then
		if invType == 'dumpster' then
			items = randomLoot(server.dumpsterloot)
		elseif invType == 'vehicle' then
			items = randomLoot(server.vehicleloot)
		end
	end

	if not items then
		items = {}
	end

	local returnData, totalWeight = table.create(#items, 0), 0
	local gridWidth, gridHeight = GridUtils.GetDimensions(invType == 'vehicle' and 'trunk' or invType)
	local grid = GridUtils.BuildOccupancy({items = {}, gridWidth = gridWidth, gridHeight = gridHeight})

	for i = 1, #items do
		local v = items[i]
		local item = Items(v[1])
		if not item then
			warn('unable to generate', v[1], 'item does not exist')
		else
			local metadata, count = Items.Metadata(inv, item, v[3] or {}, v[2])
			local weight = Inventory.SlotWeight(item, {count=count, metadata=metadata})
			totalWeight = totalWeight + weight

			local w = item.width or 1
			local h = item.height or 1
			local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)

			returnData[i] = {name = item.name, label = item.label, weight = weight, slot = i, count = count, description = item.description, metadata = metadata, stack = item.stack, stackSize = item.stackSize, close = item.close, gridX = gx or 0, gridY = gy or 0, gridRotated = rotated or false}

			if gx then
				local ew, eh = w, h
				if rotated then ew, eh = eh, ew end
				for dy = 0, eh - 1 do
					for dx = 0, ew - 1 do
						if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
							grid[gy + dy][gx + dx] = i
						end
					end
				end
			end
		end
	end

	return returnData, totalWeight
end

---@param id string|number
---@param invType string
---@param owner string | number | boolean
function Inventory.Load(id, invType, owner)
    if not invType then return end

	local result

    if invType == 'trunk' or invType == 'glovebox' then
        result = id and (invType == 'trunk' and db.loadTrunk(id) or db.loadGlovebox(id))

        if not result then
            if server.randomloot then
                return generateItems(id, 'vehicle')
            end
        else
            result = result[invType]
        end
	elseif invType == 'dumpster' then
		if server.randomloot then
			return generateItems(id, invType)
		end
	elseif id then
		result = db.loadStash(owner or '', id)
	end

	local returnData, weight = {}, 0

	if result and type(result) == 'string' then
		result = json.decode(result)
	end

	if result then
		local ostime = os.time()

		for _, v in pairs(result) do
			local item = Items(v.name)
			if item then
				v.metadata = Items.CheckMetadata(v.metadata or {}, item, v.name, ostime)
				local slotWeight = Inventory.SlotWeight(item, v)
				weight += slotWeight
				returnData[v.slot] = {name = item.name, label = item.label, weight = slotWeight, slot = v.slot, count = v.count, description = item.description, metadata = v.metadata, stack = item.stack, stackSize = item.stackSize, close = item.close, gridX = v.gridX, gridY = v.gridY, gridRotated = v.gridRotated}
			end
		end

		if GridUtils.IsGridInventory(invType) then
			local gridWidth, gridHeight = GridUtils.GetDimensions(invType)
			local needsPlacement = false

			for _, v in pairs(returnData) do
				if v.gridX == nil then
					needsPlacement = true
					break
				end
			end

			if needsPlacement then
				local positioned = {}
				for slot, v in pairs(returnData) do
					if v.gridX ~= nil then
						positioned[slot] = v
					end
				end
				local grid = GridUtils.BuildOccupancy({items = positioned, gridWidth = gridWidth, gridHeight = gridHeight})

				for slot, v in pairs(returnData) do
					if v.gridX == nil then
						local item = Items(v.name)
						local w = item and item.width or 1
						local h = item and item.height or 1
						local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)

						if gx then
							v.gridX = gx
							v.gridY = gy
							v.gridRotated = rotated or false

											local ew, eh = w, h
							if rotated then ew, eh = eh, ew end
							for dy = 0, eh - 1 do
								for dx = 0, ew - 1 do
									if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
										grid[gy + dy][gx + dx] = slot
									end
								end
							end
						else
							v.gridX = 0
							v.gridY = 0
							v.gridRotated = false
						end
					end
				end
			end
		end
	end

	return returnData, weight
end

local function assertMetadata(metadata)
	if metadata and type(metadata) ~= 'table' then
		metadata = metadata and { type = metadata or nil }
	end

	return metadata
end

---@param inv inventory
---@param item table | string
---@param metadata? any
---@param returnsCount? boolean
---@return table | number | nil
function Inventory.GetItem(inv, item, metadata, returnsCount)
	if type(item) ~= 'table' then item = Items(item) end

	if item then
		item = returnsCount and item or table.clone(item)
		inv = Inventory(inv)
		local count = 0

		if inv then
			local ostime = os.time()
			metadata = assertMetadata(metadata)

			for _, v in pairs(inv.items) do
				if v.name == item.name and (not metadata or table.contains(v.metadata, metadata)) and not Items.UpdateDurability(inv, v, item, nil, ostime) then
                    count += v.count
				end
			end
		end

		if returnsCount then return count else
			item.count = count
			return item
		end
	end
end
exports('GetItem', Inventory.GetItem)

---@param fromInventory any
---@param toInventory any
---@param slot1 number
---@param slot2 number
function Inventory.SwapSlots(fromInventory, toInventory, slot1, slot2)
	local fromSlot = fromInventory.items[slot1] and table.clone(fromInventory.items[slot1]) or nil
	local toSlot = toInventory.items[slot2] and table.clone(toInventory.items[slot2]) or nil

	if fromSlot then fromSlot.slot = slot2 end
	if toSlot then toSlot.slot = slot1 end

	if fromSlot and toSlot then
		local fgx, fgy, fgr = fromSlot.gridX, fromSlot.gridY, fromSlot.gridRotated
		fromSlot.gridX, fromSlot.gridY, fromSlot.gridRotated = toSlot.gridX, toSlot.gridY, toSlot.gridRotated
		toSlot.gridX, toSlot.gridY, toSlot.gridRotated = fgx, fgy, fgr
	end

	fromInventory.items[slot1], toInventory.items[slot2] = toSlot, fromSlot
	fromInventory.changed, toInventory.changed = true, true

	return fromSlot, toSlot
end
exports('SwapSlots', Inventory.SwapSlots)

function Inventory.ContainerWeight(container, metaWeight, playerInventory)
	playerInventory.weight -= container.weight
	container.weight = Items(container.name).weight
	container.weight += metaWeight
	container.metadata.weight = metaWeight
	playerInventory.weight += container.weight
end

---@param inv inventory
---@param item table | string
---@param count number
---@param metadata? table
---@return boolean? success, string|SlotWithItem|nil response
function Inventory.SetItem(inv, item, count, metadata)
	if type(item) ~= 'table' then item = Items(item) end

	if not item then return false, 'invalid_item' end
	if type(count) ~= 'number' then return false, 'invalid_count' end

	count = math.floor(count + 0.5)
	if count < 0 then return false, 'negative_count' end

	inv = Inventory(inv)

	if not inv then return false, 'invalid_inventory' end

	inv.changed = true
	local itemCount = Inventory.GetItem(inv, item.name, metadata, true)

	if count > itemCount then
		count -= itemCount
		return Inventory.AddItem(inv, item.name, count, metadata)
	elseif count < itemCount then
		itemCount -= count
		return Inventory.RemoveItem(inv, item.name, itemCount, metadata)
	end
end
exports('SetItem', Inventory.SetItem)

---@param inv inventory
function Inventory.GetCurrentWeapon(inv)
	inv = Inventory(inv)

	if inv?.player then
		local weapon = inv.items[inv.weapon]

		if weapon and Items(weapon.name).weapon then
			return weapon
		end

		inv.weapon = nil
	end
end
exports('GetCurrentWeapon', Inventory.GetCurrentWeapon)

---@param inv inventory
---@param slotId number
---@return table? item
function Inventory.GetSlot(inv, slotId)
	if not inv or type(slotId) ~= 'number' then return end

	inv = Inventory(inv)
	local slot = inv and inv.items?[slotId]

	if slot and not Items.UpdateDurability(inv, slot, Items(slot.name), nil, os.time()) then
        return slot
	end
end
exports('GetSlot', Inventory.GetSlot)

---@param inv inventory
---@param slotId number
---@param durability number
function Inventory.SetDurability(inv, slotId, durability)
	if not inv or type(slotId) ~= 'number' or type(durability) ~= 'number' then return end

	inv = Inventory(inv)
	local slot = inv and inv.items?[slotId]

	if not slot then return end

    Items.UpdateDurability(inv, slot, Items(slot.name), durability)

    if inv.player and server.syncInventory then
        server.syncInventory(inv)
    end
end
exports('SetDurability', Inventory.SetDurability)

local Utils = require 'modules.utils.server'

---@param inv inventory
---@param slotId number
---@param metadata { [string]: any }
function Inventory.SetMetadata(inv, slotId, metadata)
	if not inv or type(slotId) ~= 'number' then return end

	inv = Inventory(inv)
	local slot = inv and inv.items?[slotId]

	if not slot then return end

    local item = Items(slot.name)
    local imageurl = slot.metadata.imageurl
    slot.metadata = type(metadata) == 'table' and metadata or { type = metadata or nil }
    inv.changed = true

    if metadata.weight then
        inv.weight -= slot.weight
        slot.weight = Inventory.SlotWeight(item, slot)
        inv.weight += slot.weight
    end

    if metadata.durability ~= slot.metadata.durability then
        Items.UpdateDurability(inv, slot, item, metadata.durability)
    else
        inv:syncSlotsWithClients({
            {
                item = slot,
                inventory = inv.id
            }
        }, true)
    end

    if inv.player and server.syncInventory then
        server.syncInventory(inv)
    end

    if metadata.imageurl ~= imageurl and Utils.IsValidImageUrl then
        if Utils.IsValidImageUrl(metadata.imageurl) then
            Utils.DiscordEmbed('Valid image URL', ('Updated item "%s" (%s) with valid url in "%s".\n%s\nid: %s\nowner: %s'):format(metadata.label or slot.label, slot.name, inv.label, metadata.imageurl, inv.id, inv.owner, metadata.imageurl), metadata.imageurl, 65280)
        else
            Utils.DiscordEmbed('Invalid image URL', ('Updated item "%s" (%s) with invalid url in "%s".\n%s\nid: %s\nowner: %s'):format(metadata.label or slot.label, slot.name, inv.label, metadata.imageurl, inv.id, inv.owner, metadata.imageurl), metadata.imageurl, 16711680)
            metadata.imageurl = nil
        end
    end
end

exports('SetMetadata', Inventory.SetMetadata)

---@param inv inventory
---@param slots number
function Inventory.SetSlotCount(inv, slots)
	inv = Inventory(inv)

	if not inv then return end
	if type(slots) ~= 'number' then return end

	inv.changed = true
	inv.slots = slots

	if inv.player then
        TriggerClientEvent('ox_inventory:refreshSlotCount', inv.id, {inventoryId = inv.id, slots = inv.slots})
    end

    for playerId in pairs(inv.openedBy) do
        if playerId ~= inv.id then
            TriggerClientEvent('ox_inventory:refreshSlotCount', playerId, {inventoryId = inv.id, slots = inv.slots})
        end
	end
end

exports('SetSlotCount', Inventory.SetSlotCount)

---@param inv inventory
---@param maxWeight number
function Inventory.SetMaxWeight(inv, maxWeight)
	inv = Inventory(inv)

	if not inv then return end
	if type(maxWeight) ~= 'number' then return end

	inv.maxWeight = maxWeight

    if inv.player then
        TriggerClientEvent('ox_inventory:refreshMaxWeight', inv.id, {inventoryId = inv.id, maxWeight = inv.maxWeight})
    end

    for playerId in pairs(inv.openedBy) do
        if playerId ~= inv.id then
            TriggerClientEvent('ox_inventory:refreshMaxWeight', playerId, {inventoryId = inv.id, maxWeight = inv.maxWeight})
        end
	end
end

exports('SetMaxWeight', Inventory.SetMaxWeight)

---@param inv inventory
---@param item table | string
---@param count number
---@param metadata? table | string
---@param slot? number
---@param cb? fun(success?: boolean, response: string|SlotWithItem|nil)
---@return boolean? success, string|SlotWithItem|nil response
function Inventory.AddItem(inv, item, count, metadata, slot, cb)
	if type(item) ~= 'table' then item = Items(item) end

	if not item then return false, 'invalid_item' end
	if type(count) ~= 'number' then return false, 'invalid_count' end

	count = math.floor(count + 0.5)
	if count <= 0 then return false, 'negative_count' end

	inv = Inventory(inv)

	if not inv?.slots then return false, 'invalid_inventory' end

	local toSlot, slotMetadata, slotCount
	local success, response = false

	metadata = assertMetadata(metadata)

	if slot then
		local slotData = inv.items[slot]
		slotMetadata, slotCount = Items.Metadata(inv.id, item, metadata and table.clone(metadata) or {}, count)

		if not slotData or (item.stack and slotData.name == item.name and table.matches(slotData.metadata, slotMetadata)) then
			if not item.stackSize or not slotData or (slotData.count + count) <= item.stackSize then
				toSlot = slot
			end
		end
	end

	local isGrid = GridUtils.IsGridInventory(inv.type)
	local gridPlacement

	if not toSlot then
		local items = inv.items
		slotMetadata, slotCount = Items.Metadata(inv.id, item, metadata and table.clone(metadata) or {}, count)

		if isGrid then
			local stackSize = item.stack and item.stackSize or nil

			for k, slotData in pairs(items) do
				if item.stack and slotData and slotData.name == item.name and table.matches(slotData.metadata, slotMetadata) then
					if not stackSize or (slotData.count + count) <= stackSize then
						toSlot = k
						break
					end
				end
			end

			if not toSlot then
				local gridWidth = inv.gridWidth or shared.gridwidth or 12
				local gridHeight = inv.gridHeight or shared.gridheight or 5
				local grid = GridUtils.BuildOccupancy(inv)
				local w, h
				if item.weapon and slotMetadata and slotMetadata.components then
					w, h = GridUtils.ComputeWeaponSize(item, slotMetadata)
				else
					w = item.width or 1
					h = item.height or 1
				end

				if not item.stack then
					toSlot = {}
					for _ = 1, count do
						local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
						if not gx then break end

						local newSlot = 1
						for k2 in pairs(items) do
							if type(k2) == 'number' and k2 >= newSlot then
								newSlot = k2 + 1
							end
						end
						for _, ts in ipairs(toSlot) do
							if ts.slot >= newSlot then newSlot = ts.slot + 1 end
						end

						toSlot[#toSlot + 1] = { slot = newSlot, count = slotCount, metadata = slotMetadata, gridX = gx, gridY = gy, gridRotated = rotated or false }

						local ew, eh = w, h
						if rotated then ew, eh = eh, ew end
						for dy = 0, eh - 1 do
							for dx = 0, ew - 1 do
								if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
									grid[gy + dy][gx + dx] = newSlot
								end
							end
						end

						count -= 1
						if count < 1 then break end
						slotMetadata, slotCount = Items.Metadata(inv.id, item, metadata and table.clone(metadata) or {}, count)
					end

					if #toSlot == 0 then toSlot = nil end
				elseif stackSize then
					toSlot = {}
					local remaining = count

					for k, slotData in pairs(items) do
						if remaining <= 0 then break end
						if slotData and slotData.name == item.name and table.matches(slotData.metadata, slotMetadata) then
							local canAdd = stackSize - slotData.count
							if canAdd > 0 then
								local addCount = math.min(remaining, canAdd)
								toSlot[#toSlot + 1] = { slot = k, count = addCount, metadata = slotMetadata }
								remaining = remaining - addCount
							end
						end
					end

					while remaining > 0 do
						local newSlotCount = math.min(remaining, stackSize)
						local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
						if not gx then break end

						local newSlot = 1
						for k2 in pairs(items) do
							if type(k2) == 'number' and k2 >= newSlot then
								newSlot = k2 + 1
							end
						end
						for _, ts in ipairs(toSlot) do
							if ts.slot >= newSlot then newSlot = ts.slot + 1 end
						end

						toSlot[#toSlot + 1] = { slot = newSlot, count = newSlotCount, metadata = slotMetadata, gridX = gx, gridY = gy, gridRotated = rotated or false }

						local ew, eh = w, h
						if rotated then ew, eh = eh, ew end
						for dy = 0, eh - 1 do
							for dx = 0, ew - 1 do
								if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
									grid[gy + dy][gx + dx] = newSlot
								end
							end
						end

						remaining = remaining - newSlotCount
					end

					if #toSlot == 0 then toSlot = nil end
				else
					local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
					if gx then
						local newSlot = 1
						for k2 in pairs(items) do
							if type(k2) == 'number' and k2 >= newSlot then
								newSlot = k2 + 1
							end
						end
						toSlot = newSlot
						gridPlacement = { gridX = gx, gridY = gy, gridRotated = rotated or false }
					end
				end
			end
		else
			local stackSize = item.stack and item.stackSize or nil

			for i = 1, inv.slots do
				local slotData = items[i]

				if item.stack and slotData ~= nil and slotData.name == item.name and table.matches(slotData.metadata, slotMetadata) then
					if not stackSize or (slotData.count + count) <= stackSize then
						toSlot = i
						break
					end
				elseif not item.stack and not slotData then
					if not toSlot then toSlot = {} end

					toSlot[#toSlot + 1] = { slot = i, count = slotCount, metadata = slotMetadata }

					if count == slotCount then
						break
					end

					count -= 1
					slotMetadata, slotCount = Items.Metadata(inv.id, item, metadata and table.clone(metadata) or {}, count)
				elseif not toSlot and not slotData then
					toSlot = i
				end
			end

			if not toSlot and stackSize then
				toSlot = {}
				local remaining = count

				for i = 1, inv.slots do
					if remaining <= 0 then break end
					local slotData = items[i]

					if slotData and slotData.name == item.name and table.matches(slotData.metadata, slotMetadata) then
						local canAdd = stackSize - slotData.count
						if canAdd > 0 then
							local addCount = math.min(remaining, canAdd)
							toSlot[#toSlot + 1] = { slot = i, count = addCount, metadata = slotMetadata }
							remaining = remaining - addCount
						end
					elseif not slotData and remaining > 0 then
						local newSlotCount = math.min(remaining, stackSize)
						toSlot[#toSlot + 1] = { slot = i, count = newSlotCount, metadata = slotMetadata }
						remaining = remaining - newSlotCount
					end
				end

				if #toSlot == 0 then toSlot = nil end
			end
		end
	end

	if not toSlot then return false, 'inventory_full' end

	inv.changed = true

	local invokingResource = server.loglevel > 1 and GetInvokingResource()
	local toSlotType = type(toSlot)

	if toSlotType == 'number' then
		Inventory.SetSlot(inv, item, slotCount, slotMetadata, toSlot, gridPlacement and true or nil)

		if gridPlacement and inv.items[toSlot] then
			inv.items[toSlot].gridX = gridPlacement.gridX
			inv.items[toSlot].gridY = gridPlacement.gridY
			inv.items[toSlot].gridRotated = gridPlacement.gridRotated
		end

		if inv.player and server.syncInventory then
			server.syncInventory(inv)
		end

		inv:syncSlotsWithClients({
			{
				item = inv.items[toSlot],
				inventory = inv.id
			}
		}, true)

		if invokingResource then
			lib.logger(inv.owner, 'addItem', ('"%s" added %sx %s to "%s"'):format(invokingResource, count, item.name, inv.label))
		end

		success = true
		response = inv.items[toSlot]
	elseif toSlotType == 'table' then
		local added = 0

		for i = 1, #toSlot do
			local data = toSlot[i]
			added += data.count
			Inventory.SetSlot(inv, item, data.count, data.metadata, data.slot, data.gridX and true or nil)

			if data.gridX and inv.items[data.slot] then
				inv.items[data.slot].gridX = data.gridX
				inv.items[data.slot].gridY = data.gridY
				inv.items[data.slot].gridRotated = data.gridRotated
			end

			toSlot[i] = { item = inv.items[data.slot], inventory = inv.id }
		end

		if inv.player and server.syncInventory then
			server.syncInventory(inv)
		end

		inv:syncSlotsWithClients(toSlot, true)

		if invokingResource then
			lib.logger(inv.owner, 'addItem', ('"%s" added %sx %s to "%s"'):format(invokingResource, added, item.name, inv.label))
		end

		for i = 1, #toSlot do
			toSlot[i] = toSlot[i].item
		end

		success = true
		response = toSlot
	end

	if cb then
		return cb(success, response)
	end

	return success, response
end

exports('AddItem', Inventory.AddItem)

---@param inv inventory
---@param search string|number slots|1, count|2
---@param items table | string
---@param metadata? table | string
function Inventory.Search(inv, search, items, metadata)
	if items then
		inv = Inventory(inv)

		if inv then
			inv = inv.items

			if search == 'slots' then search = 1 elseif search == 'count' then search = 2 end
			if type(items) == 'string' then items = {items} end

			metadata = assertMetadata(metadata)
			local itemCount = #items
			local returnData = {}

			for i = 1, itemCount do
				local item = string.lower(items[i])
				if item:sub(0, 7) == 'weapon_' then item = string.upper(item) end

				if search == 1 then
					returnData[item] = {}
				elseif search == 2 then
					returnData[item] = 0
				end

				for _, v in pairs(inv) do
					if v.name == item then
						if not v.metadata then v.metadata = {} end

						if not metadata or table.contains(v.metadata, metadata) then
							if search == 1 then
								returnData[item][#returnData[item]+1] = inv[v.slot]
							elseif search == 2 then
								returnData[item] += v.count
							end
						end
					end
				end
			end

			if next(returnData) then return itemCount == 1 and returnData[items[1]] or returnData end
		end
	end

	return false
end
exports('Search', Inventory.Search)

---@param inv inventory
---@param item table | string
---@param metadata? table
---@param strict? boolean
function Inventory.GetItemSlots(inv, item, metadata, strict)
	if type(item) ~= 'table' then item = Items(item) end
	if not item then return end

	inv = Inventory(inv)
	if not inv?.slots and not GridUtils.IsGridInventory(inv?.type) then return end

	local totalCount, slots = 0, {}

	if strict == nil then strict = true end
	local tablematch = strict and table.matches or table.contains

	local itemCount = 0
	for k, v in pairs(inv.items) do
		itemCount = itemCount + 1
		if v.name == item.name then
			if metadata and v.metadata == nil then
				v.metadata = {}
			end
			if not metadata or tablematch(v.metadata, metadata) then
				totalCount = totalCount + v.count
				slots[k] = v.count
			end
		end
	end

	local emptySlots
	if GridUtils.IsGridInventory(inv.type) then
		local gridWidth = inv.gridWidth or shared.gridwidth or 10
		local gridHeight = inv.gridHeight or shared.gridheight or 7
		emptySlots = (gridWidth * gridHeight) - itemCount
		if emptySlots < 0 then emptySlots = 0 end
	else
		emptySlots = inv.slots - itemCount
	end

	return slots, totalCount, emptySlots
end
exports('GetItemSlots', Inventory.GetItemSlots)

---@param inv inventory
---@param item table | string
---@param count integer
---@param metadata? table | string
---@param slot? number
---@param ignoreTotal? boolean
---@param strict? boolean
---@return boolean? success, string? response
function Inventory.RemoveItem(inv, item, count, metadata, slot, ignoreTotal, strict)
	if type(item) ~= 'table' then item = Items(item) end

	if not item then return false, 'invalid_item' end
	if type(count) ~= 'number' then return false, 'invalid_count' end

	count = math.floor(count + 0.5)
	if count <= 0 then return false, 'negative_count' end

	inv = Inventory(inv)

	if not inv?.slots then return false, 'invalid_inventory' end

	metadata = assertMetadata(metadata)
	if strict == nil then strict = true end
	local itemSlots, totalCount = Inventory.GetItemSlots(inv, item, metadata, strict)

	if not itemSlots then return false end

	if totalCount and count > totalCount then
		if not ignoreTotal then return false, 'not_enough_items' end

		count = totalCount
	end

	local removed, total, slots = 0, count, {}

	if slot and itemSlots[slot] then
		removed = count
		Inventory.SetSlot(inv, item, -count, inv.items[slot].metadata, slot)
		slots[#slots+1] = inv.items[slot] or slot
	elseif itemSlots and totalCount > 0 then
		for k, v in pairs(itemSlots) do
			if removed < total then
				if v == count then
					TriggerClientEvent('ox_inventory:itemNotify', inv.id, { inv.items[k], 'ui_removed', v })

					removed = total
					inv.weight -= inv.items[k].weight
					inv.items[k] = nil
					slots[#slots+1] = inv.items[k] or k
				elseif v > count then
					Inventory.SetSlot(inv, item, -count, inv.items[k].metadata, k)
					slots[#slots+1] = inv.items[k] or k
					removed = total
					count = v - count
				else
					TriggerClientEvent('ox_inventory:itemNotify', inv.id, { inv.items[k], 'ui_removed', v })

					removed = removed + v
					count = count - v
					inv.weight -= inv.items[k].weight
					inv.items[k] = nil
					slots[#slots+1] = k
				end
			else break end
		end
	end

	if removed > 0 then
		inv.changed = true

		if inv.player and server.syncInventory then
			server.syncInventory(inv)
		end

		local array = table.create(#slots, 0)

		for k, v in pairs(slots) do
			array[k] = {item = type(v) == 'number' and { slot = v } or v, inventory = inv.id}
		end

		inv:syncSlotsWithClients(array, true)

		local invokingResource = server.loglevel > 1 and GetInvokingResource()

		if invokingResource then
			lib.logger(inv.owner, 'removeItem', ('"%s" removed %sx %s from "%s"'):format(invokingResource, removed, item.name, inv.label))
		end

		return true
	end

	return false, 'not_enough_items'
end
exports('RemoveItem', Inventory.RemoveItem)

---@param inv inventory
---@param item table | string
---@param count number
---@param metadata? table | string
function Inventory.CanCarryItem(inv, item, count, metadata)
	if type(item) ~= 'table' then item = Items(item) end

	if item then
		inv = Inventory(inv)

		if inv then
			local itemSlots, _, emptySlots = Inventory.GetItemSlots(inv, item, type(metadata) == 'table' and metadata or { type = metadata or nil })

			if not itemSlots then return end

			local weight = metadata and metadata.weight or item.weight

			local isGrid = GridUtils.IsGridInventory(inv.type)

			if next(itemSlots) or emptySlots > 0 or isGrid then
				if not count then count = 1 end

				if not item.stack and not isGrid and emptySlots < count then return false end

				if weight ~= 0 then
					local newWeight = inv.weight + (weight * count)
					if newWeight > inv.maxWeight then
						return false
					end
				end

				if isGrid and not next(itemSlots) then
					local gridWidth = inv.gridWidth or shared.gridwidth or 10
					local gridHeight = inv.gridHeight or shared.gridheight or 7
					local grid = GridUtils.BuildOccupancy(inv)
					local w = item.width or 1
					local h = item.height or 1
					if not GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h) then
						return false
					end
				end

				return true
			end
		end
	end
end
exports('CanCarryItem', Inventory.CanCarryItem)

---@param inv inventory
---@param item table | string
function Inventory.CanCarryAmount(inv, item)
    if type(item) ~= 'table' then item = Items(item) end
	inv = Inventory(inv)

    if inv and item then
		local weightAmount = item.weight > 0 and math.floor((inv.maxWeight - inv.weight) / item.weight) or 1000000

		if GridUtils.IsGridInventory(inv.type) then
			local gridWidth = inv.gridWidth or shared.gridwidth or 10
			local gridHeight = inv.gridHeight or shared.gridheight or 7
			local grid = GridUtils.BuildOccupancy(inv)
			local w = item.width or 1
			local h = item.height or 1
			local gridAmount = 0

			if item.stack then
				local stackSize = item.stackSize

				if stackSize then
					local existingCapacity = 0
					for _, slotData in pairs(inv.items) do
						if slotData and slotData.name == item.name then
							existingCapacity = existingCapacity + (stackSize - slotData.count)
						end
					end

					local newStackCapacity = 0
					while existingCapacity + newStackCapacity < weightAmount do
						local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
						if not gx then break end
						newStackCapacity = newStackCapacity + stackSize

						local ew, eh = w, h
						if rotated then ew, eh = eh, ew end
						for dy = 0, eh - 1 do
							for dx = 0, ew - 1 do
								if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
									grid[gy + dy][gx + dx] = true
								end
							end
						end
					end

					gridAmount = existingCapacity + newStackCapacity
				else
					local hasStack = false
					for _, slotData in pairs(inv.items) do
						if slotData and slotData.name == item.name then
							hasStack = true
							break
						end
					end

					if hasStack then
						gridAmount = weightAmount
					else
						gridAmount = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h) and weightAmount or 0
					end
				end
			else
				for _ = 1, weightAmount do
					local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)
					if not gx then break end
					gridAmount = gridAmount + 1

					local ew, eh = w, h
					if rotated then ew, eh = eh, ew end
					for dy = 0, eh - 1 do
						for dx = 0, ew - 1 do
							if grid[gy + dy] and grid[gy + dy][gx + dx] ~= nil then
								grid[gy + dy][gx + dx] = true
							end
						end
					end
				end
			end

			return math.min(weightAmount, gridAmount)
		end

		return weightAmount
    end
end

exports('CanCarryAmount', Inventory.CanCarryAmount)

---@param inv inventory
---@param weight number
function Inventory.CanCarryWeight(inv, weight)
	inv = Inventory(inv)

	if not inv then return end

	local availableWeight = inv.maxWeight - inv.weight
	local canHold = availableWeight >= weight
	return canHold, availableWeight
end
exports('CanCarryWeight', Inventory.CanCarryWeight)

---@param inv inventory
---@param firstItem string
---@param firstItemCount number
---@param testItem string
---@param testItemCount number
function Inventory.CanSwapItem(inv, firstItem, firstItemCount, testItem, testItemCount)
	inv = Inventory(inv)

	if not inv then return end

	local firstItemData = Inventory.GetItem(inv, firstItem)
	local testItemData = Inventory.GetItem(inv, testItem)

	if firstItemData and testItemData and firstItemData.count >= firstItemCount then
		local weightWithoutFirst = inv.weight - (firstItemData.weight * firstItemCount)
		local weightWithTest = weightWithoutFirst + (testItemData.weight * testItemCount)
		return weightWithTest <= inv.maxWeight
	end
end
exports('CanSwapItem', Inventory.CanSwapItem)

---Mostly for internal use, but deprecated.
---@param name string
---@param count number
---@param metadata { [string]: any }
---@param slot number
RegisterServerEvent('ox_inventory:removeItem', function(name, count, metadata, slot)
	Inventory.RemoveItem(source, name, count, metadata, slot)
end)

Inventory.Drops = {}

---@param prefix string?
---@return string
local function generateInvId(prefix)
	while true do
		local invId = ('%s-%s'):format(prefix or 'drop', math.random(100000, 999999))

		if not Inventories[invId] then return invId end

		Wait(0)
	end
end

local function CustomDrop(prefix, items, coords, slots, maxWeight, instance, model)
	local dropId = generateInvId()
	local inventory = Inventory.Create(dropId, ('%s %s'):format(prefix, dropId:gsub('%D', '')), 'drop', slots or shared.dropslots, 0, maxWeight or shared.dropweight, false, {})

	if not inventory then return end

	inventory.items, inventory.weight = generateItems(inventory, 'drop', items)
	inventory.coords = coords
	Inventory.Drops[dropId] = {
		coords = inventory.coords,
		instance = instance,
		model = model,
	}

	TriggerClientEvent('ox_inventory:createDrop', -1, dropId, Inventory.Drops[dropId])

    return dropId
end

AddEventHandler('ox_inventory:customDrop', CustomDrop)
exports('CustomDrop', CustomDrop)

exports('CreateDropFromPlayer', function(playerId)
	local playerInventory = Inventory(playerId)

	if not playerInventory or not next(playerInventory.items) then return end

	local dropId = generateInvId()
	local inventory = Inventory.Create(dropId, ('Drop %s'):format(dropId:gsub('%D', '')), 'drop', playerInventory.slots, playerInventory.weight, playerInventory.maxWeight, false, table.clone(playerInventory.items))

	if not inventory then return end

	local coords = GetEntityCoords(GetPlayerPed(playerId))
	inventory.coords = vec3(coords.x, coords.y, coords.z-0.2)
	Inventory.Drops[dropId] = {
		coords = inventory.coords,
		instance = Player(playerId).state.instance
	}

	Inventory.Clear(playerInventory)
	TriggerClientEvent('ox_inventory:createDrop', -1, dropId, Inventory.Drops[dropId])

	return dropId
end)

local TriggerEventHooks = require 'modules.hooks.server'

---@class SwapSlotData
---@field count number
---@field fromSlot number
---@field toSlot number
---@field instance any
---@field fromType string
---@field toType string
---@field coords? vector3
---@field toGridX? number
---@field toGridY? number
---@field rotated? boolean

---@param source number
---@param playerInventory OxInventory
---@param fromInventory OxInventory
---@param fromData SlotWithItem?
---@param data SwapSlotData
local function dropItem(source, playerInventory, fromInventory, fromData, data)
    if not fromData then return end

	local toData = table.clone(fromData)
	toData.slot = data.toSlot
	toData.count = data.count
	toData.weight = Inventory.SlotWeight(Items(toData.name), toData)
	toData.gridX = 0
	toData.gridY = 0
	toData.gridRotated = false

    if toData.weight > shared.dropweight then return end

    local dropId = generateInvId('drop')

	if not TriggerEventHooks('swapItems', {
		source = source,
		fromInventory = fromInventory.id,
		fromSlot = fromData,
		fromType = fromInventory.type,
		toInventory = 'newdrop',
		toSlot = data.toSlot,
		toType = 'drop',
		count = data.count,
        action = 'move',
        dropId = dropId,
	}) then return end

    fromData.count -= data.count
    fromData.weight = Inventory.SlotWeight(Items(fromData.name), fromData)

    if fromData.count < 1 then
        fromData = nil
    else
        toData.metadata = table.clone(toData.metadata)
    end

	local slot = data.fromSlot
	fromInventory.weight -= toData.weight
	fromInventory.items[slot] = fromData

	if fromInventory == playerInventory and slot == playerInventory.weapon then
		playerInventory.weapon = nil
	end

	local inventory = Inventory.Create(dropId, ('Drop %s'):format(dropId:gsub('%D', '')), 'drop', shared.dropslots, toData.weight, shared.dropweight, false, {[data.toSlot] = toData})

	if not inventory then return end

	inventory.coords = data.coords
	Inventory.Drops[dropId] = {coords = inventory.coords, instance = data.instance}
	fromInventory.changed = true

	TriggerClientEvent('ox_inventory:createDrop', -1, dropId, Inventory.Drops[dropId], playerInventory.open and source, slot)

	if server.loglevel > 0 then
		lib.logger(playerInventory.owner, 'swapSlots', ('%sx %s transferred from "%s" to "%s"'):format(data.count, toData.name, fromInventory.label or fromInventory.id, dropId))
	end

	local responseItems = {
		{
			item = fromData or { slot = data.fromSlot },
			inventory = fromInventory.id
		}
	}

	if fromInventory.type == 'backpack' and playerInventory.backpackSlot then
		local backpackItem = playerInventory.items[playerInventory.backpackSlot]
		if backpackItem then
			Inventory.ContainerWeight(backpackItem, fromInventory.weight, playerInventory)
			responseItems[#responseItems + 1] = {
				item = backpackItem,
				inventory = playerInventory.id
			}
		end
	end

	if server.syncInventory then server.syncInventory(playerInventory) end

	return true, {
		weight = playerInventory.weight,
		items = responseItems
	}
end

local activeSlots = {}

---@param source number
---@param data SwapSlotData
lib.callback.register('ox_inventory:swapItems', function(source, data)
	if data.count < 1 then return end

	local playerInventory = Inventory(source)

	if not playerInventory then return end

	local function resolveInventory(invType)
		if invType == 'player' then return playerInventory
		elseif invType == 'backpack' then return playerInventory.openBackpack and Inventory(playerInventory.openBackpack)
		else return Inventory(playerInventory.open)
		end
	end

	local toInventory = resolveInventory(data.toType)
	local fromInventory = resolveInventory(data.fromType)

	if not fromInventory or not toInventory then
		if (data.fromType == 'backpack' and not fromInventory) or (data.toType == 'backpack' and not toInventory) then
			return false
		end
		playerInventory:closeInventory()
		return
	end

    if data.toType == 'inspect' or data.fromType == 'inspect' then return end

	local fromRef = ('%s:%s'):format(fromInventory.id, data.fromSlot)
	local toRef = ('%s:%s'):format(toInventory.id, data.toSlot)

	if activeSlots[fromRef] or activeSlots[toRef] then
		return false, {
			{
				item = toInventory.items[data.toSlot] or { slot = data.toSlot },
				inventory = toInventory.id
			},
			{
				item = fromInventory.items[data.fromSlot] or { slot = data.fromSlot },
				inventory = fromInventory.id
			}
		}
	end

	local sameInventory = fromInventory.id == toInventory.id
	local fromOtherPlayer = fromInventory.player and fromInventory ~= playerInventory
	local toOtherPlayer = toInventory.player and toInventory ~= playerInventory
	local toData = toInventory.items[data.toSlot]

	if not sameInventory and (fromInventory.type == 'policeevidence' or (toInventory.type == 'policeevidence' and toData)) then
		local group, rank = server.hasGroup(playerInventory, shared.police)

		if not group or server.evidencegrade > rank then
			return false, 'evidence_cannot_take'
		end
	end

	activeSlots[fromRef] = true
	activeSlots[toRef] = true

	local _ <close> = defer(function()
		activeSlots[fromRef] = nil
		activeSlots[toRef] = nil
	end)

	if sameInventory and data.fromSlot == data.toSlot and data.toGridX ~= nil then
		local fromData = fromInventory.items[data.fromSlot]
		if fromData and GridUtils.IsGridInventory(fromInventory.type) then
			local gridWidth = fromInventory.gridWidth or shared.gridwidth or 12
			local gridHeight = fromInventory.gridHeight or shared.gridheight or 5
			local itemData = Items(fromData.name)
			local w, h
			if itemData and itemData.weapon and fromData.metadata and fromData.metadata.components then
				w, h = GridUtils.ComputeWeaponSize(itemData, fromData.metadata)
			else
				w = itemData and itemData.width or 1
				h = itemData and itemData.height or 1
			end
			if data.rotated then w, h = h, w end

			local gx = math.floor(tonumber(data.toGridX) or 0)
			local gy = math.floor(tonumber(data.toGridY) or 0)

			local grid = GridUtils.BuildOccupancy(fromInventory, data.fromSlot)
			if not GridUtils.CanPlace(grid, gridWidth, gridHeight, gx, gy, w, h) then
				print(('[ox_inventory] grid_collision (reposition): item=%s slot=%d gx=%d gy=%d w=%d h=%d gridW=%d gridH=%d'):format(
					fromData.name, data.fromSlot, gx, gy, w, h, gridWidth, gridHeight
				))
				for dy = 0, h - 1 do
					for dx = 0, w - 1 do
						local cy, cx = gy + dy, gx + dx
						if grid[cy] and grid[cy][cx] then
							local blockingItem = fromInventory.items[grid[cy][cx]]
							print(('[ox_inventory]   cell (%d,%d) occupied by slot %s (%s at gridX=%s gridY=%s)'):format(
								cx, cy, tostring(grid[cy][cx]),
								blockingItem and blockingItem.name or '?',
								blockingItem and tostring(blockingItem.gridX) or '?',
								blockingItem and tostring(blockingItem.gridY) or '?'
							))
						elseif not grid[cy] or grid[cy][cx] == nil then
							print(('[ox_inventory]   cell (%d,%d) out of bounds'):format(cx, cy))
						end
					end
				end
				return false, 'grid_collision'
			end

			fromData.gridX = gx
			fromData.gridY = gy
			fromData.gridRotated = data.rotated or false
			if fromInventory.changed ~= nil then fromInventory.changed = true end

			if fromInventory.type == 'backpack' and fromInventory.openedBy then
				fromInventory.openedBy[source] = nil
				fromInventory:syncSlotsWithClients({
					{
						item = fromData,
						inventory = fromInventory.id
					}
				}, true)
				fromInventory.openedBy[source] = true
			else
				fromInventory:syncSlotsWithClients({
					{
						item = fromData,
						inventory = fromInventory.id
					}
				}, true)
			end

			return true
		end
	end

	if toInventory and (data.toType == 'newdrop' or fromInventory ~= toInventory or data.fromSlot ~= data.toSlot) then
		local fromData = fromInventory.items[data.fromSlot]

		if not fromData then
			return false, {
				{
					item = { slot = data.fromSlot },
					inventory = fromInventory.id
				},
				{
					item = toData or { slot = data.toSlot },
					inventory = toInventory.id
				}
			}
		end

        if data.count > fromData.count then
            data.count = fromData.count
        end

        if data.toType == 'newdrop' then
            if playerInventory.backpackSlot == data.fromSlot and fromData.metadata and fromData.metadata.isBackpack then
                local backpack = Inventory(playerInventory.openBackpack)
                if backpack then
                    if backpack.openedBy then backpack.openedBy[source] = nil end
                    backpack.changed = true
                end
                playerInventory.openBackpack = nil
                playerInventory.backpackSlot = nil
            end
            return dropItem(source, playerInventory, fromInventory, fromData, data)
        end

		if fromData then
            if fromData.metadata.container and toInventory.type == 'container' then return false end
            if toData and toData.metadata.container and fromInventory.type == 'container' then return false end

            if fromData.metadata.container and toInventory.type == 'backpack' then return false end
            if toData and toData.metadata and toData.metadata.container and fromInventory.type == 'backpack' then return false end

            if fromData.metadata.isBackpack and toInventory.type == 'container' then return false end

			if fromInventory.type == 'player' and playerInventory.backpackSlot == data.fromSlot
				and fromData.metadata.isBackpack then
				local backpack = Inventory(playerInventory.openBackpack)
				if backpack then
					if backpack.openedBy then backpack.openedBy[source] = nil end
					if backpack.changed then Inventory.Save(backpack) end
				end
				playerInventory.openBackpack = nil
				playerInventory.backpackSlot = nil
			end

			if toInventory.type == 'backpack' and not sameInventory and fromInventory ~= playerInventory then
				local itemDef = Items(fromData.name)
				if itemDef then
					local tempSlot = {
						name = fromData.name,
						count = data.count,
						metadata = fromData.metadata or {},
					}
					local incomingWeight = Inventory.SlotWeight(itemDef, tempSlot)
					local outgoing = 0
					if toData and toData.name and toData.name ~= fromData.name then
						outgoing = toData.weight or 0
					end

					local netChange = incomingWeight - outgoing
					if netChange > 0 and playerInventory.weight + netChange > playerInventory.maxWeight then
						return false, 'cannot_carry'
					end
				end
			end

			local container, containerItem = (not sameInventory and playerInventory.containerSlot) and (fromInventory.type == 'container' and fromInventory or toInventory)

			if container then
				containerItem = playerInventory.items[playerInventory.containerSlot]
			end

			local backpackItem = (not sameInventory and playerInventory.backpackSlot)
				and (fromInventory.type == 'backpack' or toInventory.type == 'backpack')
				and playerInventory.items[playerInventory.backpackSlot] or nil

			local hookPayload = {
				source = source,
				fromInventory = fromInventory.id,
				fromSlot = fromData,
				fromType = fromInventory.type,
				toInventory = toInventory.id,
				toSlot = toData or data.toSlot,
				toType = toInventory.type,
				count = data.count,
			}

			if toData and ((toData.name ~= fromData.name) or not toData.stack or (not table.matches(toData.metadata, fromData.metadata))) then
				local toWeight = not sameInventory and (toInventory.weight - toData.weight + fromData.weight) or 0
				local fromWeight = not sameInventory and (fromInventory.weight + toData.weight - fromData.weight) or 0
				hookPayload.action = 'swap'

				if not sameInventory then
					if (toWeight <= toInventory.maxWeight and fromWeight <= fromInventory.maxWeight) then
						if not TriggerEventHooks('swapItems', hookPayload) then return end

						if containerItem then
							local toContainer = toInventory.type == 'container'
							local whitelist = Items.containers[containerItem.name]?.whitelist
							local blacklist = Items.containers[containerItem.name]?.blacklist
							local checkItem = toContainer and fromData.name or toData.name

							if (whitelist and not whitelist[checkItem]) or (blacklist and blacklist[checkItem]) then
								return
							end

							Inventory.ContainerWeight(containerItem, toContainer and toWeight or fromWeight, playerInventory)
						end

						if backpackItem then
							local toBackpack = toInventory.type == 'backpack'
							local bpWhitelist = Items.containers[backpackItem.name]?.whitelist
							local bpBlacklist = Items.containers[backpackItem.name]?.blacklist
							local bpCheckItem = toBackpack and fromData.name or toData.name

							if (bpWhitelist and not bpWhitelist[bpCheckItem]) or (bpBlacklist and bpBlacklist[bpCheckItem]) then
								return
							end

							Inventory.ContainerWeight(backpackItem, toBackpack and toWeight or fromWeight, playerInventory)
						end

						if fromOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', fromInventory.id, { fromData, 'ui_removed', fromData.count })
							TriggerClientEvent('ox_inventory:itemNotify', fromInventory.id, { toData, 'ui_added', toData.count })
						elseif toOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', toInventory.id, { fromData, 'ui_added', fromData.count })
							TriggerClientEvent('ox_inventory:itemNotify', toInventory.id, { toData, 'ui_removed', toData.count })
						end

						fromInventory.weight = fromWeight
						toInventory.weight = toWeight
						toData, fromData = Inventory.SwapSlots(fromInventory, toInventory, data.fromSlot, data.toSlot)

						if data.rotated ~= nil and toData then
							toData.gridRotated = data.rotated
						end
						if data.targetRotated ~= nil and fromData then
							fromData.gridRotated = data.targetRotated
						end

						if server.loglevel > 0 then
							lib.logger(playerInventory.owner, 'swapSlots', ('%sx %s transferred from "%s" to "%s" for %sx %s'):format(fromData.count, fromData.name, fromInventory.owner and fromInventory.label or fromInventory.id, toInventory.owner and toInventory.label or toInventory.id, toData.count, toData.name))
						end
					else return false, 'cannot_carry' end
				else
					if not TriggerEventHooks('swapItems', hookPayload) then return end

					toData, fromData = Inventory.SwapSlots(fromInventory, toInventory, data.fromSlot, data.toSlot)

					if data.rotated ~= nil and toData then
						toData.gridRotated = data.rotated
					end
					if data.targetRotated ~= nil and fromData then
						fromData.gridRotated = data.targetRotated
					end
				end

			elseif toData and toData.name == fromData.name and table.matches(toData.metadata, fromData.metadata) then
				local itemDef = Items(toData.name)
				local stackSize = itemDef and itemDef.stackSize

				if stackSize then
					local canAdd = stackSize - toData.count
					if canAdd <= 0 then return end
					data.count = math.min(data.count, canAdd)
					hookPayload.count = data.count
				end

				toData.count += data.count
				fromData.count -= data.count
				local toSlotWeight = Inventory.SlotWeight(Items(toData.name), toData)
				local totalWeight = toInventory.weight - toData.weight + toSlotWeight
				local weightDelta = toSlotWeight - toData.weight

				if fromInventory.type == 'container' or fromInventory.type == 'backpack' or sameInventory or totalWeight <= toInventory.maxWeight then
					hookPayload.action = 'stack'

					if not TriggerEventHooks('swapItems', hookPayload) then
						toData.count -= data.count
						fromData.count += data.count
						return
					end

					local fromSlotWeight = Inventory.SlotWeight(Items(fromData.name), fromData)
					toData.weight = toSlotWeight

					if not sameInventory then
						fromInventory.weight = fromInventory.weight - fromData.weight + fromSlotWeight
						toInventory.weight = totalWeight

						if container then
							Inventory.ContainerWeight(containerItem, toInventory.type == 'container' and toInventory.weight or fromInventory.weight, playerInventory)
						end

						if backpackItem then
							Inventory.ContainerWeight(backpackItem, toInventory.type == 'backpack' and toInventory.weight or fromInventory.weight, playerInventory)
						end

						if fromOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', fromInventory.id, { fromData, 'ui_removed', data.count })
						elseif toOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', toInventory.id, { toData, 'ui_added', data.count })
						end

						if server.loglevel > 0 then
							lib.logger(playerInventory.owner, 'swapSlots', ('%sx %s transferred from "%s" to "%s"'):format(data.count, fromData.name, fromInventory.owner and fromInventory.label or fromInventory.id, toInventory.owner and toInventory.label or toInventory.id))
						end
					end

					fromData.weight = fromSlotWeight
				else
					toData.count -= data.count
					fromData.count += data.count
					return false, 'cannot_carry'
				end
			elseif data.count <= fromData.count then
				toData = table.clone(fromData)
				toData.count = data.count
				toData.slot = data.toSlot
				toData.weight = Inventory.SlotWeight(Items(toData.name), toData)

				if data.toGridX ~= nil then
					toData.gridX = math.floor(tonumber(data.toGridX) or 0)
					toData.gridY = math.floor(tonumber(data.toGridY) or 0)
					toData.gridRotated = data.rotated or false
				end

				if GridUtils.IsGridInventory(toInventory.type) and toData.gridX ~= nil then
					local gridWidth = toInventory.gridWidth or shared.gridwidth or 12
					local gridHeight = toInventory.gridHeight or shared.gridheight or 5
					local itemData = Items(toData.name)
					local w, h
					if itemData and itemData.weapon and toData.metadata and toData.metadata.components then
						w, h = GridUtils.ComputeWeaponSize(itemData, toData.metadata)
					else
						w = itemData and itemData.width or 1
						h = itemData and itemData.height or 1
					end
					if toData.gridRotated then w, h = h, w end

					local grid = GridUtils.BuildOccupancy(toInventory, sameInventory and data.fromSlot or nil)
					if not GridUtils.CanPlace(grid, gridWidth, gridHeight, toData.gridX, toData.gridY, w, h) then
						print(('[ox_inventory] grid_collision (move): item=%s from=%s to=%s gx=%d gy=%d w=%d h=%d gridW=%d gridH=%d sameInv=%s'):format(
							toData.name, tostring(fromInventory.id), tostring(toInventory.id),
							toData.gridX, toData.gridY, w, h, gridWidth, gridHeight, tostring(sameInventory)
						))
						for dy = 0, h - 1 do
							for dx = 0, w - 1 do
								local cy, cx = toData.gridY + dy, toData.gridX + dx
								if grid[cy] and grid[cy][cx] then
									local blockingItem = toInventory.items[grid[cy][cx]]
									print(('[ox_inventory]   cell (%d,%d) occupied by slot %s (%s at gridX=%s gridY=%s)'):format(
										cx, cy, tostring(grid[cy][cx]),
										blockingItem and blockingItem.name or '?',
										blockingItem and tostring(blockingItem.gridX) or '?',
										blockingItem and tostring(blockingItem.gridY) or '?'
									))
								elseif not grid[cy] or grid[cy][cx] == nil then
									print(('[ox_inventory]   cell (%d,%d) out of bounds'):format(cx, cy))
								end
							end
						end
						return false, 'grid_collision'
					end
				end

				if fromInventory.type == 'container' or fromInventory.type == 'backpack' or sameInventory or (toInventory.weight + toData.weight <= toInventory.maxWeight) then
					hookPayload.action = 'move'

					if not TriggerEventHooks('swapItems', hookPayload) then return end

					if not sameInventory then
						local toContainer = toInventory.type == 'container'

						if container then
							if toContainer and containerItem then
								local whitelist = Items.containers[containerItem.name]?.whitelist
								local blacklist = Items.containers[containerItem.name]?.blacklist

								if (whitelist and not whitelist[fromData.name]) or (blacklist and blacklist[fromData.name]) then
									return
								end
							end
						end

						fromInventory.weight -= toData.weight
						toInventory.weight += toData.weight

						if container then
							Inventory.ContainerWeight(containerItem, toContainer and toInventory.weight or fromInventory.weight, playerInventory)
						end

						if backpackItem then
							local toBackpack = toInventory.type == 'backpack'

							if toBackpack and backpackItem then
								local bpWhitelist = Items.containers[backpackItem.name]?.whitelist
								local bpBlacklist = Items.containers[backpackItem.name]?.blacklist

								if (bpWhitelist and not bpWhitelist[fromData.name]) or (bpBlacklist and bpBlacklist[fromData.name]) then
									return
								end
							end

							Inventory.ContainerWeight(backpackItem, toBackpack and toInventory.weight or fromInventory.weight, playerInventory)
						end

						if fromOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', fromInventory.id, { fromData, 'ui_removed', data.count })
						elseif toOtherPlayer then
							TriggerClientEvent('ox_inventory:itemNotify', toInventory.id, { fromData, 'ui_added', data.count })
						end

						if server.loglevel > 0 then
							lib.logger(playerInventory.owner, 'swapSlots', ('%sx %s transferred from "%s" to "%s"'):format(data.count, fromData.name, fromInventory.owner and fromInventory.label or fromInventory.id, toInventory.owner and toInventory.label or toInventory.id))
						end
					end

					fromData.count -= data.count
					fromData.weight = Inventory.SlotWeight(Items(fromData.name), fromData)

					if fromData.count > 0 then
						toData.metadata = table.clone(toData.metadata)
					end
				else return false, 'cannot_carry_other' end
			end

			if fromData and fromData.count < 1 then fromData = nil end

			---@type updateSlot[]
			local items = {}

			if fromInventory.player and not fromOtherPlayer then
				if toInventory.type == 'container' and containerItem then
					items[#items + 1] = {
						item = containerItem,
						inventory = playerInventory.id
					}
				end

				if toInventory.type == 'backpack' and backpackItem then
					items[#items + 1] = {
						item = backpackItem,
						inventory = playerInventory.id
					}
				end
			end

			if toInventory.player and not toOtherPlayer then
				if fromInventory.type == 'container' and containerItem then
					items[#items + 1] = {
						item = containerItem,
						inventory = playerInventory.id
					}
				end

				if fromInventory.type == 'backpack' and backpackItem then
					items[#items + 1] = {
						item = backpackItem,
						inventory = playerInventory.id
					}
				end
			end

			fromInventory.items[data.fromSlot] = fromData
			toInventory.items[data.toSlot] = toData

			if fromInventory.changed ~= nil then fromInventory.changed = true end
			if toInventory.changed ~= nil then toInventory.changed = true end

			if toInventory.type == 'backpack' then
				items[#items + 1] = {
					item = toInventory.items[data.toSlot] or { slot = data.toSlot },
					inventory = toInventory.id
				}
			end
			if fromInventory.type == 'backpack' then
				items[#items + 1] = {
					item = fromInventory.items[data.fromSlot] or { slot = data.fromSlot },
					inventory = fromInventory.id
				}
			end

            CreateThread(function()
                local removedFromTo, removedFromFrom
                if toInventory.type == 'backpack' and toInventory.openedBy and toInventory.openedBy[source] then
                    toInventory.openedBy[source] = nil
                    removedFromTo = true
                end
                if fromInventory.type == 'backpack' and fromInventory.openedBy and fromInventory.openedBy[source] then
                    fromInventory.openedBy[source] = nil
                    removedFromFrom = true
                end

                if sameInventory then
                    fromInventory:syncSlotsWithClients({
                        {
                            item = fromInventory.items[data.toSlot] or { slot = data.toSlot },
                            inventory = fromInventory.id
                        },
                        {
                            item = fromInventory.items[data.fromSlot] or { slot = data.fromSlot },
                            inventory = fromInventory.id
                        }
                    }, true)
                else
                    toInventory:syncSlotsWithClients({
                        {
                            item = toInventory.items[data.toSlot] or { slot = data.toSlot },
                            inventory = toInventory.id
                        }
                    }, true)

                    fromInventory:syncSlotsWithClients({
                        {
                            item = fromInventory.items[data.fromSlot] or { slot = data.fromSlot },
                            inventory = fromInventory.id
                        }
                    }, true)
                end

                if removedFromTo then toInventory.openedBy[source] = true end
                if removedFromFrom then fromInventory.openedBy[source] = true end
            end)

			local resp

			if next(items) then
				resp = { weight = playerInventory.weight, items = items }
			end

			if server.syncInventory then
				if fromInventory.player then
					server.syncInventory(fromInventory)
				end

				if toInventory.player and not sameInventory then
					server.syncInventory(toInventory)
				end
			end

			local weaponSlot

			if toInventory.weapon == data.toSlot then
				if not sameInventory then
					toInventory.weapon = nil
					TriggerClientEvent('ox_inventory:disarm', toInventory.id)
				else
					weaponSlot = data.fromSlot
					toInventory.weapon = weaponSlot
				end
			end

			if fromInventory.weapon == data.fromSlot then
				if not sameInventory then
					fromInventory.weapon = nil
					TriggerClientEvent('ox_inventory:disarm', fromInventory.id)
				elseif not weaponSlot then
					weaponSlot = data.toSlot
					fromInventory.weapon = weaponSlot
				end
			end

			return containerItem and containerItem.weight or backpackItem and backpackItem.weight or true, resp, weaponSlot
		end
	end
end)

lib.callback.register('ox_inventory:sortInventory', function(source, data)
	local inventoryId = data and data.inventoryId
	local inv

	if not inventoryId or inventoryId == tostring(source) then
		inv = Inventories[source]
	else
		inv = Inventories[inventoryId]
	end

	if not inv then return false end

	if inv.id ~= source and not inv.openedBy[source] then
		return false
	end

	if inv.type == 'shop' or inv.type == 'crafting' then
		return false
	end

	if inv.player and inv.id ~= source then
		return false
	end

	local gridWidth = inv.gridWidth or GridUtils.GetDimensions(inv.type)
	local _, gridHeightFromType = GridUtils.GetDimensions(inv.type)
	local gridHeight = inv.gridHeight or gridHeightFromType

	local allItems = {}

	for slot, item in pairs(inv.items) do
		if item and item.name then
			allItems[#allItems + 1] = { slot = slot, item = item }
		end
	end

	if #allItems == 0 then return false end

	local merged = {}
	local removedSlots = {}
	local mergeUpdates = {}

	local groups = {}
	for _, entry in ipairs(allItems) do
		local name = entry.item.name
		if not groups[name] then groups[name] = {} end
		groups[name][#groups[name] + 1] = entry
	end

	for name, group in pairs(groups) do
		local itemData = Items(name)
		local isStackable = itemData and itemData.stack
		local stackSize = itemData and itemData.stackSize

		if isStackable and #group > 1 then
			local metaGroups = {}

			for _, entry in ipairs(group) do
				local found = false
				for _, mg in ipairs(metaGroups) do
					if table.matches(mg[1].item.metadata, entry.item.metadata) then
						mg[#mg + 1] = entry
						found = true
						break
					end
				end
				if not found then
					metaGroups[#metaGroups + 1] = { entry }
				end
			end

			for _, mg in ipairs(metaGroups) do
				local totalCount = 0
				for _, entry in ipairs(mg) do
					totalCount = totalCount + (entry.item.count or 1)
				end

				if stackSize then
					for _, entry in ipairs(mg) do
						removedSlots[entry.slot] = true
					end

					local remaining = totalCount
					local entryIdx = 1
					while remaining > 0 and entryIdx <= #mg do
						local slotCount = math.min(remaining, stackSize)
						local entry = mg[entryIdx]
						removedSlots[entry.slot] = nil

						if slotCount ~= (entry.item.count or 1) then
							mergeUpdates[entry.slot] = slotCount
						end
						entry.item.count = slotCount
						merged[#merged + 1] = entry
						remaining = remaining - slotCount
						entryIdx = entryIdx + 1
					end
				else
					local target = mg[1]
					for i = 2, #mg do
						removedSlots[mg[i].slot] = true
					end

					if totalCount ~= (target.item.count or 1) then
						mergeUpdates[target.slot] = totalCount
					end
					target.item.count = totalCount
					merged[#merged + 1] = target
				end
			end
		else
			for _, entry in ipairs(group) do
				merged[#merged + 1] = entry
			end
		end
	end

	for _, entry in ipairs(merged) do
		local itemData = Items(entry.item.name)
		if itemData and itemData.weapon and entry.item.metadata and entry.item.metadata.components then
			entry.width, entry.height = GridUtils.ComputeWeaponSize(itemData, entry.item.metadata)
		else
			entry.width = itemData and itemData.width or 1
			entry.height = itemData and itemData.height or 1
		end
		entry.area = entry.width * entry.height
	end

	table.sort(merged, function(a, b)
		if a.area ~= b.area then return a.area > b.area end
		return a.item.name < b.item.name
	end)

	local grid = {}
	for y = 0, gridHeight - 1 do
		grid[y] = {}
		for x = 0, gridWidth - 1 do
			grid[y][x] = false
		end
	end

	local placements = {}

	for _, entry in ipairs(merged) do
		local gx, gy, rotated = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, entry.width, entry.height)

		if not gx then
			return false
		end

		placements[#placements + 1] = {
			slot = entry.slot,
			item = entry.item,
			gx = gx,
			gy = gy,
			rotated = rotated or false,
		}

		local w, h = entry.width, entry.height
		if rotated then w, h = h, w end

		for dy = 0, h - 1 do
			for dx = 0, w - 1 do
				local cx = gx + dx
				local cy = gy + dy
				if grid[cy] and grid[cy][cx] ~= nil then
					grid[cy][cx] = entry.slot
				end
			end
		end
	end

	local updateSlots = {}
	local weightDelta = 0

	for slot in pairs(removedSlots) do
		local removedItem = inv.items[slot]
		if removedItem then
			weightDelta = weightDelta - (removedItem.weight or 0)

			updateSlots[#updateSlots + 1] = {
				item = { slot = slot },
				inventory = inv.id,
			}
			inv.items[slot] = nil
		end
	end

	for slot, newCount in pairs(mergeUpdates) do
		local item = inv.items[slot]
		if item then
			local itemData = Items(item.name)
			local oldWeight = item.weight or 0
			local newWeight = Inventory.SlotWeight(itemData, { count = newCount, metadata = item.metadata })
			weightDelta = weightDelta + (newWeight - oldWeight)

			item.count = newCount
			item.weight = newWeight
		end
	end

	for _, p in ipairs(placements) do
		p.item.gridX = p.gx
		p.item.gridY = p.gy
		p.item.gridRotated = p.rotated

		updateSlots[#updateSlots + 1] = {
			item = p.item,
			inventory = inv.id,
		}
	end

	if #updateSlots == 0 then return false end

	if weightDelta ~= 0 then
		inv.weight = (inv.weight or 0) + weightDelta
	end

	if inv.changed ~= nil then inv.changed = true end

	inv:syncSlotsWithClients(updateSlots, true)

	if server.syncInventory and inv.player then
		server.syncInventory(inv)
	end

	return true
end)

lib.callback.register('ox_inventory:attachComponent', function(source, data)
	if not data or not data.componentSlot or not data.weaponSlot then return false end

	local inv = Inventory(source)
	if not inv then return false end

	local compRef = ('%s:%s'):format(inv.id, data.componentSlot)
	local weapRef = ('%s:%s'):format(inv.id, data.weaponSlot)
	if activeSlots[compRef] or activeSlots[weapRef] then return false end
	activeSlots[compRef] = true
	activeSlots[weapRef] = true
	local _ <close> = defer(function()
		activeSlots[compRef] = nil
		activeSlots[weapRef] = nil
	end)

	local componentItem = inv.items[data.componentSlot]
	local weaponItem = inv.items[data.weaponSlot]

	if not componentItem or not weaponItem then return false end

	local componentData = Items(componentItem.name)
	local weaponData = Items(weaponItem.name)

	if not componentData or not componentData.component then return false end
	if not weaponData or not weaponData.weapon then return false end

	if componentData.compatibleWeapons then
		local compatible = false
		for _, weaponName in ipairs(componentData.compatibleWeapons) do
			if weaponName == weaponItem.name then compatible = true; break end
		end
		if not compatible then return false end
	end

	if not weaponItem.metadata then weaponItem.metadata = {} end
	if not weaponItem.metadata.components then weaponItem.metadata.components = {} end

	local compType = componentData.type
	if compType then
		for _, existingComp in ipairs(weaponItem.metadata.components) do
			local existingData = Items(existingComp)
			if existingData and existingData.type == compType then
				return false
			end
		end
	end

	local testComponents = {}
	for _, c in ipairs(weaponItem.metadata.components) do
		testComponents[#testComponents + 1] = c
	end
	testComponents[#testComponents + 1] = componentItem.name
	local newW, newH = GridUtils.ComputeWeaponSize(weaponData, { components = testComponents })

	if GridUtils.IsGridInventory(inv.type) and weaponItem.gridX ~= nil then
		local gridWidth = inv.gridWidth or shared.gridwidth or 12
		local gridHeight = inv.gridHeight or shared.gridheight or 5
		local grid = GridUtils.BuildOccupancy(inv, data.weaponSlot)
		local w, h = newW, newH
		if weaponItem.gridRotated then w, h = h, w end
		if not GridUtils.CanPlace(grid, gridWidth, gridHeight, weaponItem.gridX, weaponItem.gridY or 0, w, h) then
			return false
		end
	end

	local oldWeaponWeight = weaponItem.weight or 0
	if not Inventory.RemoveItem(inv, componentItem.name, 1, nil, data.componentSlot) then return false end

	table.insert(weaponItem.metadata.components, componentItem.name)
	weaponItem.weight = Inventory.SlotWeight(weaponData, weaponItem)

	inv.weight = inv.weight + (weaponItem.weight - oldWeaponWeight)

	inv.changed = true
	inv:syncSlotsWithClients({
		{ item = weaponItem }
	}, true)

	if server.syncInventory then server.syncInventory(inv) end

	return true
end)

function Inventory.Confiscate(source)
	local inv = Inventory(source)

	if inv?.player then
		db.saveStash(inv.owner, inv.owner, json.encode(minimal(inv)))
		table.wipe(inv.items)
		inv.weight = 0
		inv.changed = true

		TriggerClientEvent('ox_inventory:inventoryConfiscated', inv.id)

		if server.syncInventory then server.syncInventory(inv) end
	end
end
exports('ConfiscateInventory', Inventory.Confiscate)

function Inventory.Return(source)
	local inv = Inventory(source)

	if not inv?.player then return end

	local items = MySQL.scalar.await('SELECT data FROM ox_inventory WHERE name = ?', { inv.owner })

    if not items then return end

	MySQL.update.await('DELETE FROM ox_inventory WHERE name = ?', { inv.owner })

    items = json.decode(items)
    local inventory, totalWeight = {}, 0

    if table.type(items) == 'array' then
        for i = 1, #items do
            local data = items[i]
            if type(data) == 'number' then break end

            local item = Items(data.name)

            if item then
                local weight = Inventory.SlotWeight(item, data)
                totalWeight = totalWeight + weight
                inventory[data.slot] = {name = data.name, label = item.label, weight = weight, slot = data.slot, count = data.count, description = item.description, metadata = data.metadata, stack = item.stack, close = item.close, gridX = data.gridX, gridY = data.gridY, gridRotated = data.gridRotated}
            end
        end
    end

    inv.changed = true
    inv.weight = totalWeight
    inv.items = inventory

    TriggerClientEvent('ox_inventory:inventoryReturned', source, { inventory, totalWeight })

    if server.syncInventory then server.syncInventory(inv) end
end

exports('ReturnInventory', Inventory.Return)

---@param inv inventory
---@param keep? string | string[] an item or list of items to ignore while clearing items
function Inventory.Clear(inv, keep)
	inv = Inventory(inv)

	if not inv or not next(inv.items) then return end

	local updateSlots = {}
	local newWeight = 0
	local inc = 0

	if keep then
		local keptItems = {}
		local keepType = type(keep)

		if keepType == 'string' then
			for slot, v in pairs(inv.items) do
				if v.name == keep then
					keptItems[v.slot] = v
					newWeight += v.weight
				elseif updateSlots then
					inc += 1
					updateSlots[inc] = { item = { slot = slot }, inventory = inv.id }
				end
			end
		elseif keepType == 'table' and table.type(keep) == 'array' then
			for slot, v in pairs(inv.items) do
				for i = 1, #keep do
					if v.name == keep[i] then
						keptItems[v.slot] = v
						newWeight += v.weight
						goto foundItem
					end
				end

				if updateSlots then
					inc += 1
					updateSlots[inc] = { item = { slot = slot }, inventory = inv.id }
				end

				::foundItem::
			end
		end

		table.wipe(inv.items)
		inv.items = keptItems
	else
		if updateSlots then
			for slot in pairs(inv.items) do
				inc += 1
				updateSlots[inc] = { item = { slot = slot }, inventory = inv.id }
			end
		end

		table.wipe(inv.items)
	end

	inv.weight = newWeight
	inv.changed = true

	inv:syncSlotsWithClients(updateSlots, true)

	if not inv.player then
		if inv.open then
			local playerInv = Inventory(inv.open)

			if not playerInv then return end

			playerInv:closeInventory()
		end

		inv:openInventory(inv)

		return
	end

	if server.syncInventory then server.syncInventory(inv) end

	inv.weapon = nil
end

exports('ClearInventory', Inventory.Clear)

---@param inv inventory
---@return integer?
function Inventory.GetEmptySlot(inv)
	local inventory = Inventory(inv)

	if not inventory then return end

	if GridUtils.IsGridInventory(inventory.type) then
		local maxSlot = 0
		for k in pairs(inventory.items) do
			if type(k) == 'number' and k > maxSlot then
				maxSlot = k
			end
		end
		return maxSlot + 1
	end

	local items = inventory.items

	for i = 1, inventory.slots do
		if not items[i] then
			return i
		end
	end
end

exports('GetEmptySlot', Inventory.GetEmptySlot)

---@param inv inventory
---@param itemName string
---@param metadata any
function Inventory.GetSlotForItem(inv, itemName, metadata)
	local inventory = Inventory(inv)
	local item = Items(itemName)

	if not inventory or not item then return end

	metadata = assertMetadata(metadata)
	local items = inventory.items

	if GridUtils.IsGridInventory(inventory.type) then
		for k, slotData in pairs(items) do
			if item.stack and slotData and slotData.name == item.name and table.matches(slotData.metadata, metadata) then
				return k
			end
		end

		local gridWidth = inventory.gridWidth or shared.gridwidth or 10
		local gridHeight = inventory.gridHeight or shared.gridheight or 7
		local grid = GridUtils.BuildOccupancy(inventory)
		local w = item.width or 1
		local h = item.height or 1
		local gx = GridUtils.FindFirstFit(grid, gridWidth, gridHeight, w, h)

		if gx then
			local maxSlot = 0
			for k in pairs(items) do
				if type(k) == 'number' and k > maxSlot then
					maxSlot = k
				end
			end
			return maxSlot + 1
		end

		return nil
	end

	local emptySlot

	for i = 1, inventory.slots do
		local slotData = items[i]

		if item.stack and slotData and slotData.name == item.name and table.matches(slotData.metadata, metadata) then
			return i
		elseif not item.stack and not slotData and not emptySlot then
			emptySlot = i
		end
	end

	return emptySlot
end

exports('GetSlotForItem', Inventory.GetSlotForItem)

---@param inv inventory
---@param itemName string
---@param metadata? any
---@param strict? boolean Strictly match metadata properties, otherwise use partial matching.
---@return SlotWithItem?
function Inventory.GetSlotWithItem(inv, itemName, metadata, strict)
	local inventory = Inventory(inv)
	local item = Items(itemName)

	if not inventory or not item then return end

	metadata = assertMetadata(metadata)
	local tablematch = strict and table.matches or table.contains

	for _, slotData in pairs(inventory.items) do
		if slotData and slotData.name == item.name and (not metadata or tablematch(slotData.metadata, metadata)) then
            if not Items.UpdateDurability(inventory, slotData, item, nil, os.time()) then
                return slotData
            end
		end
	end
end

exports('GetSlotWithItem', Inventory.GetSlotWithItem)

---@param inv inventory
---@param itemName string
---@param metadata? any
---@param strict? boolean Strictly match metadata properties, otherwise use partial matching.
---@return number?
function Inventory.GetSlotIdWithItem(inv, itemName, metadata, strict)
	return Inventory.GetSlotWithItem(inv, itemName, metadata, strict)?.slot
end

exports('GetSlotIdWithItem', Inventory.GetSlotIdWithItem)

---@param inv inventory
---@param itemName string
---@param metadata? any
---@param strict? boolean Strictly match metadata properties, otherwise use partial matching.
---@return SlotWithItem[]?
function Inventory.GetSlotsWithItem(inv, itemName, metadata, strict)
	local inventory = Inventory(inv)
	local item = Items(itemName)

	if not inventory or not item then return end

	metadata = assertMetadata(metadata)
	local response = {}
	local n = 0
	local tablematch = strict and table.matches or table.contains

	for _, slotData in pairs(inventory.items) do
		if slotData and slotData.name == item.name and (not metadata or tablematch(slotData.metadata, metadata)) then
            if not Items.UpdateDurability(inventory, slotData, item, nil, os.time()) then
                n += 1
                response[n] = slotData
            end
		end
	end

	return response
end

exports('GetSlotsWithItem', Inventory.GetSlotsWithItem)

---@param inv inventory
---@param itemName string
---@param metadata? any
---@param strict? boolean Strictly match metadata properties, otherwise use partial matching.
---@return number[]?
function Inventory.GetSlotIdsWithItem(inv, itemName, metadata, strict)
	local items = Inventory.GetSlotsWithItem(inv, itemName, metadata, strict)

	if items then
		---@cast items +number[]
		for i = 1, #items do
			items[i] = items[i].slot
		end

		return items
	end
end

exports('GetSlotIdsWithItem', Inventory.GetSlotIdsWithItem)

---@param inv inventory
---@param itemName string
---@param metadata? any
---@param strict? boolean Strictly match metadata properties, otherwise use partial matching.
---@return number
function Inventory.GetItemCount(inv, itemName, metadata, strict)
	local inventory = Inventory(inv)
	local item = Items(itemName)

	if not inventory or not item then return 0 end

	metadata = assertMetadata(metadata)
	local count = 0
	local tablematch = strict and table.matches or table.contains

	for _, slotData in pairs(inventory.items) do
		if slotData and slotData.name == item.name and (not metadata or tablematch(slotData.metadata, metadata)) then
			count += slotData.count
		end
	end

	return count
end

exports('GetItemCount', Inventory.GetItemCount)

---@alias InventorySaveData { [1]: MinimalInventorySlot, [2]: string | number, [3]: string | number | nil }

---@param inv OxInventory
---@param buffer table
---@param time integer
---@return integer?
---@return InventorySaveData?
local function prepareInventorySave(inv, buffer, time)
    local shouldSave = not inv.datastore and inv.changed
    local n = 0

    for k, v in pairs(inv.items) do
        if not Items.UpdateDurability(inv, v, Items(v.name), nil, time) and shouldSave then
            n += 1
            buffer[n] = {
                name = v.name,
                count = v.count,
                slot = k,
                metadata = next(v.metadata) and v.metadata or nil,
                gridX = v.gridX,
                gridY = v.gridY,
                gridRotated = v.gridRotated,
            }
        end
	end

    if not shouldSave then return end

    local data = next(buffer) and json.encode(buffer) or nil
    inv.changed = false
    table.wipe(buffer)

    if inv.player then
        if shared.framework == 'esx' then return end

        return 1, { data, inv.owner }
    end

    if inv.type == 'trunk' then
        return 2, { data, inv.dbId }
    end

    if inv.type == 'glovebox' then
        return 3, { data, inv.dbId }
    end

    return 4, { data, inv.owner and tostring(inv.owner) or '', inv.dbId }
end

local isSaving = false
local inventoryClearTime = GetConvarInt('inventory:cleartime', 5) * 60

local function saveInventories(clearInventories)
	if isSaving then return end

	local time = os.time()
	local parameters = { {}, {}, {}, {} }
	local total = { 0, 0, 0, 0, 0 }
    local buffer = {}

	for _, inv in pairs(Inventories) do
        local index, data = prepareInventorySave(inv, buffer, time)

        if index and data then
            total[5] += 1

            if index == 4 and server.bulkstashsave then
                for i = 1, 3 do
					total[index] += 1
                    parameters[index][total[index]] = data[i]
                end
            else
				total[index] += 1
                parameters[index][total[index]] = data
            end
        end
	end

    if total[5] > 0 then
        isSaving = true
        local ok, err = pcall(db.saveInventories, parameters[1], parameters[2], parameters[3], parameters[4], total)
        isSaving = false

        if not ok and err then return lib.print.error(err) end
    end

    if not clearInventories then return end

    for _, inv in pairs(Inventories) do
        if not inv.open and not inv.player then
            -- clear inventory from memory if unused for x minutes, or on entity/netid mismatch
            if inv.type == 'glovebox' or inv.type == 'trunk' then
                if NetworkGetEntityFromNetworkId(inv.netid) ~= inv.entityId then
                    Inventory.Remove(inv)
                end
            elseif time - inv.time >= inventoryClearTime then
                Inventory.Remove(inv)
            end
        end
    end
end

lib.cron.new('*/5 * * * *', function()
    saveInventories(true)
end)

function Inventory.SaveInventories(lock, clearInventories)
	Inventory.Lock = lock or nil

	Inventory.CloseAll()
    saveInventories(clearInventories)
end

AddEventHandler('playerDropped', function()
	server.playerDropped(source)

	if GetNumPlayerIndices() == 0 then
		Inventory.SaveInventories(false, true)
	end
end)

AddEventHandler('txAdmin:events:serverShuttingDown', function()
	Inventory.SaveInventories(true, false)
end)

AddEventHandler('txAdmin:events:scheduledRestart', function(eventData)
    if eventData.secondsRemaining ~= 60 then return end

	Inventory.SaveInventories(true, true)
end)

AddEventHandler('onResourceStop', function(resource)
	if resource == shared.resource then
		Inventory.SaveInventories(true, false)
	end
end)

RegisterServerEvent('ox_inventory:closeInventory', function()
	local inventory = Inventories[source]

	if inventory?.open then
		local secondary = Inventories[inventory.open]

		if secondary then
			secondary:closeInventory()
		end

		inventory:closeInventory(true)
	end
end)

local function giveItem(playerId, slot, target, count)
	local fromInventory = Inventory(playerId)
	local toInventory = Inventory(target)

	if not fromInventory or not toInventory then return end

	if type(count) ~= 'number' or count <= 0 then count = 1 end

	if toInventory.player then
		local data = fromInventory.items[slot]

		if not data then return end

        local targetState = Player(target).state

        if targetState.invBusy then
            return { 'cannot_give', count, data.label }
        end

		local item = Items(data.name)

		if not item or data.count < count or not Inventory.CanCarryItem(toInventory, item, count, data.metadata) or #(GetEntityCoords(fromInventory.player.ped) - GetEntityCoords(toInventory.player.ped)) > 15 then
			return { 'cannot_give', count, data.label }
		end

		local toSlot = Inventory.GetSlotForItem(toInventory, data.name, data.metadata)
		local fromRef = ('%s:%s'):format(fromInventory.id, slot)
		local toRef = ('%s:%s'):format(toInventory.id, toSlot)

		if activeSlots[fromRef] or activeSlots[toRef] then
			return { 'cannot_give', count, data.label }
		end

		activeSlots[fromRef] = true
		activeSlots[toRef] = true

		local _ <close> = defer(function()
			activeSlots[fromRef] = nil
			activeSlots[toRef] = nil
		end)

		if TriggerEventHooks('swapItems', {
			source = fromInventory.id,
			fromInventory = fromInventory.id,
			fromType = fromInventory.type,
			toInventory = toInventory.id,
			toType = toInventory.type,
			count = count,
			action = 'give',
			fromSlot = data,
		}) then
			---@todo manually call swapItems or something?
			if Inventory.AddItem(toInventory, item, count, data.metadata, toSlot) then
				if Inventory.RemoveItem(fromInventory, item, count, data.metadata, slot) then
					if server.loglevel > 0 then
						lib.logger(fromInventory.owner, 'giveItem', ('"%s" gave %sx %s to "%s"'):format(fromInventory.label, count, data.name, toInventory.label))
					end

					return
				else
					Inventory.RemoveItem(toInventory, item, count, data.metadata, toSlot)
				end
			end
		end

		return { 'cannot_give', count, data.label }
	end
end

lib.callback.register('ox_inventory:giveItem', giveItem)
RegisterServerEvent('ox_inventory:giveItem', function(...) giveItem(source, ...) end)

local function updateWeapon(source, action, value, slot, specialAmmo)
	local inventory = Inventory(source)

	if not inventory then return end

	if not action then
		inventory.weapon = nil
		return
	end

	local type = type(value)

	if type == 'table' and action == 'component' then
		local item = inventory.items[value.slot]

		if item then
			if item.metadata.components then
				for k, v in pairs(item.metadata.components) do
					if v == value.component then
						if not Inventory.AddItem(inventory, value.component, 1) then return end

						local oldWeight = item.weight or 0
						table.remove(item.metadata.components, k)
						local weaponData = Items(item.name)
						if weaponData then
							item.weight = Inventory.SlotWeight(weaponData, item)
							inventory.weight = inventory.weight + (item.weight - oldWeight)
						end

						inventory:syncSlotsWithPlayer({
							{ item = item }
						}, inventory.weight)

			            if server.syncInventory then server.syncInventory(inventory) end

						return true
					end
				end
			end
		end
	else
		if not slot then slot = inventory.weapon end
		local weapon = inventory.items[slot]

		if weapon and weapon.metadata then
			local item = Items(weapon.name)

			if not item.weapon then
				inventory.weapon = nil
				return
			end

			if action == 'load' and weapon.metadata.durability > 0 then
				local ammo = Items(weapon.name).ammoname
				local diff = value - (weapon.metadata.ammo or 0)

				if not Inventory.RemoveItem(inventory, ammo, diff, specialAmmo) then return end

				weapon.metadata.ammo = value
				weapon.metadata.specialAmmo = specialAmmo
				weapon.weight = Inventory.SlotWeight(item, weapon)
			elseif action == 'throw' then
				if not Inventory.RemoveItem(inventory, weapon.name, 1, weapon.metadata, weapon.slot) then return end
			elseif action == 'component' then
				if type == 'number' then
					if not Inventory.AddItem(inventory, weapon.metadata.components[value], 1) then return false end

					table.remove(weapon.metadata.components, value)
					weapon.weight = Inventory.SlotWeight(item, weapon)
				elseif type == 'string' then
					local component = inventory.items[tonumber(value)]
					if not component then return false end

					local componentData = Items(component.name)
					if not componentData or not componentData.component then return false end

					if componentData.compatibleWeapons then
						local compatible = false
						for _, weaponName in ipairs(componentData.compatibleWeapons) do
							if weaponName == weapon.name then compatible = true; break end
						end
						if not compatible then return false end
					end

					if componentData.type and weapon.metadata and weapon.metadata.components then
						for _, existingComp in ipairs(weapon.metadata.components) do
							local existingData = Items(existingComp)
							if existingData and existingData.type == componentData.type then
								return false
							end
						end
					end

					if GridUtils.IsGridInventory(inventory.type) and weapon.gridX ~= nil then
						local testComponents = {}
						if weapon.metadata.components then
							for _, c in ipairs(weapon.metadata.components) do
								testComponents[#testComponents + 1] = c
							end
						end
						testComponents[#testComponents + 1] = component.name
						local newW, newH = GridUtils.ComputeWeaponSize(item, { components = testComponents })
						if weapon.gridRotated then newW, newH = newH, newW end
						local gridWidth = inventory.gridWidth or shared.gridwidth or 12
						local gridHeight = inventory.gridHeight or shared.gridheight or 5
						local grid = GridUtils.BuildOccupancy(inventory, slot)
						if not GridUtils.CanPlace(grid, gridWidth, gridHeight, weapon.gridX, weapon.gridY or 0, newW, newH) then
							return false
						end
					end

					if not Inventory.RemoveItem(inventory, component.name, 1) then return false end

					table.insert(weapon.metadata.components, component.name)
					weapon.weight = Inventory.SlotWeight(item, weapon)
				end
			elseif action == 'ammo' then
				if item.hash == `WEAPON_FIREEXTINGUISHER` or item.hash == `WEAPON_PETROLCAN` or item.hash == `WEAPON_HAZARDCAN` or item.hash == `WEAPON_FERTILIZERCAN` then
					weapon.metadata.durability = math.floor(value)
					weapon.metadata.ammo = weapon.metadata.durability
				elseif value < weapon.metadata.ammo then
					local durability = Items(weapon.name).durability * math.abs((weapon.metadata.ammo or 0.1) - value)
					weapon.metadata.ammo = value
					weapon.metadata.durability = weapon.metadata.durability - durability
					weapon.weight = Inventory.SlotWeight(item, weapon)
				end
			elseif action == 'melee' and value > 0 then
				weapon.metadata.durability = weapon.metadata.durability - ((Items(weapon.name).durability or 1) * value)
			end

            if (weapon.metadata.durability or 0) < 0 then
                weapon.metadata.durability = 0
            end

            if item.hash == `WEAPON_PETROLCAN` then
                weapon.weight = Inventory.SlotWeight(item, weapon)
            end

			if action ~= 'throw' then
				inventory:syncSlotsWithPlayer({
					{ item = weapon }
				}, inventory.weight)
			end

			if server.syncInventory then server.syncInventory(inventory) end

			return true
		end
	end
end

lib.callback.register('ox_inventory:updateWeapon', updateWeapon)

RegisterNetEvent('ox_inventory:updateWeapon', function(action, value, slot, specialAmmo)
	updateWeapon(source, action, value, slot, specialAmmo)
end)

lib.callback.register('ox_inventory:removeAmmoFromWeapon', function(source, slot)
	local inventory = Inventory(source)

	if not inventory then return end

	local slotData = inventory.items[slot]

	if not slotData or not slotData.metadata.ammo or slotData.metadata.ammo < 1 then return end

	local item = Items(slotData.name)

	if not item or not item.ammoname then return end
	local specialAmmo = slotData.metadata.specialAmmo and { type = slotData.metadata.specialAmmo } or nil

	if Inventory.AddItem(inventory, item.ammoname, slotData.metadata.ammo, specialAmmo) then
		slotData.metadata.ammo = 0
		slotData.weight = Inventory.SlotWeight(item, slotData)

		inventory:syncSlotsWithPlayer({
			{ item = slotData }
		}, inventory.weight)

		if server.syncInventory then server.syncInventory(inventory) end

		return true
	end
end)

local function checkStashProperties(properties)
	local name = properties.name
	local slots = properties.slots
	local maxWeight = properties.maxWeight
	local coords = properties.coords

	if type(name) ~= 'string' then
		error(('received %s for stash name (expected string)'):format(type(name)))
	end

	if type(slots) ~= 'number' then
		error(('received %s for stash slots (expected number)'):format(type(slots)))
	end

	if type(maxWeight) ~= 'number' then
		error(('received %s for stash maxWeight (expected number)'):format(type(maxWeight)))
	end

	if coords then
		local typeof = type(coords)

		if typeof ~= 'vector3' then
			if typeof == 'table' and table.type(coords) ~= 'array' then
				coords = vec3(coords.x or coords[1], coords.y or coords[2], coords.z or coords[3])
			else
				if table.type(coords) == 'array' then
					for i = 1, #coords do
						coords[i] = vec3(coords[i].x, coords[i].y, coords[i].z)
					end
				else
					error(('received %s for stash coords (expected vector3 or array of vector3)'):format(typeof))
				end
			end
		end
	end

	return name, slots, maxWeight, coords
end

---@param name string stash identifier when loading from the database
---@param label string display name when inventory is open
---@param slots number
---@param maxWeight number
---@param owner? string|number|boolean
---@param groups? table<string, number>
---@param coords? vector3|table<vector3>
--- For simple integration with other resources that want to create valid stashes.
--- This needs to be triggered before a player can open a stash.
--- ```
--- Owner sets the stash permissions.
--- string: can only access the stash linked to the owner (usually player identifier)
--- true: each player has a unique stash, but can request other player's stashes
--- nil: always shared
---
--- groups: { ['police'] = 0 }
--- ```
local function registerStash(name, label, slots, maxWeight, owner, groups, coords)
	name, slots, maxWeight, coords = checkStashProperties({
		name = name,
		slots = slots,
		maxWeight = maxWeight,
		coords = coords,
	})

	local curStash = RegisteredStashes[name]

	if curStash then
		---@todo creating proper stash classes with inheritence would simplify updating data
		---i.e. all stashes with the same type share groups, maxweight, slots, dbid, etc.
		---only label, owner, weight, coords, and items really need to vary
		for _, stash in pairs(Inventories) do
			if stash.type == 'stash' and stash.dbId == name then
				stash.label = label or stash.label
				stash.owner = (owner and owner ~= true) and stash.owner or owner
				stash.slots = slots or stash.slots
				stash.maxWeight = maxWeight or stash.maxWeight
				stash.groups = groups or stash.groups
				stash.coords = coords or stash.coords
			end
		end
	end

	RegisteredStashes[name] = {
		name = name,
		label = label,
		owner = owner,
		slots = slots,
		maxWeight = maxWeight,
		groups = groups,
		coords = coords
	}
end

exports('RegisterStash', registerStash)

---@param properties TemporaryStashProperties
function Inventory.CreateTemporaryStash(properties)
	properties.name = generateInvId('temp')

	local name, slots, maxWeight, coords = checkStashProperties(properties)
	local inventory = Inventory.Create(name, properties.label, 'temp', slots, 0, maxWeight, properties.owner, {}, properties.groups)

	if not inventory then return end

	inventory.items, inventory.weight = generateItems(inventory, 'drop', properties.items)
	inventory.coords = coords

	return inventory.id
end

exports('CreateTemporaryStash', Inventory.CreateTemporaryStash)

function Inventory.InspectInventory(playerId, invId)
	local inventory = invId ~= playerId and Inventory(invId)
	local playerInventory = Inventory(playerId)

	if playerInventory and inventory then
		playerInventory:openInventory(inventory)
		TriggerClientEvent('ox_inventory:viewInventory', playerId, playerInventory, inventory)
	end
end

exports('InspectInventory', Inventory.InspectInventory)

return Inventory
