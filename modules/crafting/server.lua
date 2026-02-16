if not lib then return end

local CraftingBenches = {}
local Items = require 'modules.items.server'
local Inventory = require 'modules.inventory.server'
local GridUtils = require 'modules.inventory.gridutils'

---@type table<number, table<string, { item: table, count: number, metadata: table }>>
local PendingCrafts = {}
local pendingCraftCounter = 0

---@param val any
---@param min number
---@param max number
---@return number|nil
local function validateInt(val, min, max)
	if type(val) ~= 'number' then return nil end
	if val ~= math.floor(val) then return nil end
	if val < min or val > max then return nil end
	return val
end

---@param toType any
---@return string
local function validateToType(toType)
	if toType ~= 'player' and toType ~= 'backpack' then return 'player' end
	return toType
end

---@param id number
---@param data table
local function createCraftingBench(id, data)
	CraftingBenches[id] = {}
	local recipes = data.items

	if recipes then
		for i = 1, #recipes do
			local recipe = recipes[i]
			local item = Items(recipe.name)

			if item then
				recipe.weight = item.weight
				recipe.slot = i
			else
				warn(('failed to setup crafting recipe (bench: %s, slot: %s) - item "%s" does not exist'):format(id, i, recipe.name))
			end

			for ingredient, needs in pairs(recipe.ingredients) do
				if needs < 1 then
					item = Items(ingredient)

					if item and not item.durability then
						item.durability = true
					end
				end
			end
		end

		if shared.target then
			data.points = nil
		else
			data.zones = nil
		end

		CraftingBenches[id] = data
	end
end

for id, data in pairs(lib.load('data.crafting') or {}) do createCraftingBench(data.name or id, data) end

---falls back to player coords if zones and points are both nil
---@param source number
---@param bench table
---@param index number
---@return vector3
local function getCraftingCoords(source, bench, index)
	if not bench.zones and not bench.points then
		return GetEntityCoords(GetPlayerPed(source))
	else
		return shared.target and bench.zones[index].coords or bench.points[index]
	end
end

lib.callback.register('ox_inventory:openCraftingBench', function(source, id, index)
	local left, bench = Inventory(source), CraftingBenches[id]

	if not left then return end

	if bench then
		local groups = bench.groups
		local coords = getCraftingCoords(source, bench, index)

		if not coords then return end

		if groups and not server.hasGroup(left, groups) then return end
		if #(GetEntityCoords(GetPlayerPed(source)) - coords) > 10 then return end

		if left.open and left.open ~= source then
			local inv = Inventory(left.open)

			if inv?.player then
				inv:closeInventory()
			end
		end

		left:openInventory(left)
	end

	return { label = left.label, type = left.type, slots = left.slots, weight = left.weight, maxWeight = left.maxWeight, gridWidth = left.gridWidth, gridHeight = left.gridHeight }
end)

local TriggerEventHooks = require 'modules.hooks.server'

---@param source number
---@param left table Player inventory
---@param bench table Crafting bench
---@param recipeId number
---@return table|nil tbl Slot consumption map
---@return table|nil craftedItem
---@return number|nil craftCount
---@return string|nil errorMsg
local function validateAndPrepare(source, left, bench, recipeId)
	local groups = bench.groups
	local coords = getCraftingCoords(source, bench, bench.index or 1)

	if groups and not server.hasGroup(left, groups) then return nil end
	if coords and #(GetEntityCoords(GetPlayerPed(source)) - coords) > 10 then return nil end

	local recipe = bench.items[recipeId]
	if not recipe then return nil end

	local nameList, nameCount = {}, 0
	for name in pairs(recipe.ingredients) do
		nameCount += 1
		nameList[nameCount] = name
	end

	local craftedItem = Items(recipe.name)
	local craftCount = (type(recipe.count) == 'number' and recipe.count) or (table.type(recipe.count) == 'array' and math.random(recipe.count[1], recipe.count[2])) or 1

	local items = Inventory.Search(left, 'slots', nameList) or {}

	local tbl = {}
	local ingredientWeight = 0

	for name, needs in pairs(recipe.ingredients) do
		if needs == 0 then break end

		local slots = items[name] or items

		if #slots == 0 then return nil end

		if needs > 0 then
			local item = Items(name)
			if item then
				ingredientWeight = ingredientWeight + (item.weight * needs)
			end
		end

		for i = 1, #slots do
			local slot = slots[i]

			if needs == 0 then
				if not slot.metadata.durability or slot.metadata.durability > 0 then
					break
				end
			elseif needs < 1 then
				local item = Items(name)
				local durability = slot.metadata.durability

				if durability and durability >= needs * 100 then
					if durability > 100 then
						local degrade = (slot.metadata.degrade or item.degrade) * 60
						local percentage = ((durability - os.time()) * 100) / degrade

						if percentage >= needs * 100 then
							tbl[slot.slot] = needs
							break
						end
					else
						tbl[slot.slot] = needs
						break
					end
				end
			elseif needs <= slot.count then
				tbl[slot.slot] = needs
				break
			else
				tbl[slot.slot] = slot.count
				needs -= slot.count
			end

			if needs == 0 then break end
			if needs > 0 and i == #slots then return nil end
		end
	end

	return tbl, craftedItem, craftCount, recipe, ingredientWeight
end

---@param left table
---@param tbl table Slot consumption map
local function consumeIngredients(left, tbl)
	local pendingSyncs = {}

	for slot, count in pairs(tbl) do
		local invSlot = left.items[slot]

		if not invSlot then return false end

		if count < 1 then
			local item = Items(invSlot.name)
			local durability = invSlot.metadata.durability or 100

			if durability > 100 then
				local degrade = (invSlot.metadata.degrade or item.degrade) * 60
				durability -= degrade * count
			else
				durability -= count * 100
			end

			if invSlot.count > 1 then
				local emptySlot = Inventory.GetEmptySlot(left)

				if emptySlot then
					local newItem = Inventory.SetSlot(left, item, 1, table.deepclone(invSlot.metadata), emptySlot)

					if newItem then
						Items.UpdateDurability(left, newItem, item, durability < 0 and 0 or durability)
					end
				end

				invSlot.count -= 1
				invSlot.weight = Inventory.SlotWeight(item, invSlot)

				pendingSyncs[#pendingSyncs + 1] = {
					item = invSlot,
					inventory = left.id
				}
			else
				Items.UpdateDurability(left, invSlot, item, durability < 0 and 0 or durability)
			end
		else
			local removed = invSlot and Inventory.RemoveItem(left, invSlot.name, count, nil, slot)
			if not removed then return false end
		end
	end

	if #pendingSyncs > 0 then
		left:syncSlotsWithClients(pendingSyncs, true)
	end

	return true
end

lib.callback.register('ox_inventory:craftItem', function(source, id, index, recipeId, toSlot, toGridX, toGridY, rotated, toType)
	recipeId = validateInt(recipeId, 1, 1000)
	if not recipeId then return end

	toType = validateToType(toType)
	if toSlot ~= nil then
		toSlot = validateInt(toSlot, 1, 1000)
		if not toSlot then return end
	end

	local left, bench = Inventory(source), CraftingBenches[id]

	if not left then return end
	if not bench then return end

	local tbl, craftedItem, craftCount, recipe, ingredientWeight = validateAndPrepare(source, left, bench, recipeId)
	if not tbl or not recipe then return end

	local targetInv, backpackItem = resolveTargetInventory(left, toType)
	if not targetInv then return end

	local craftWeight = (craftedItem.weight + (recipe.metadata?.weight or 0)) * craftCount
	if targetInv.weight + craftWeight - ingredientWeight > targetInv.maxWeight then return false, 'cannot_carry' end

	if not TriggerEventHooks('craftItem', {
		source = source,
		benchId = id,
		benchIndex = index,
		recipe = recipe,
		toInventory = targetInv.id,
		toSlot = toSlot,
	}) then return false end

	local success = lib.callback.await('ox_inventory:startCrafting', source, id, recipeId)

	if success then
		for name, needs in pairs(recipe.ingredients) do
			if Inventory.GetItemCount(left, name) < needs then return end
		end

		if not consumeIngredients(left, tbl) then return end

		local added, newItem = Inventory.AddItem(targetInv, craftedItem, craftCount, recipe.metadata or {}, craftedItem.stack and toSlot or nil)

		if added and toGridX ~= nil and newItem then
			overrideGridPosition(targetInv, newItem, craftedItem, toGridX, toGridY, rotated)
		end

		if backpackItem and added and newItem then
			TriggerClientEvent('ox_inventory:itemNotify', source, { newItem, 'ui_added', craftCount })
		end

		if backpackItem and added then
			Inventory.ContainerWeight(backpackItem, targetInv.weight, left)
		end
	end

	return success
end)

lib.callback.register('ox_inventory:startCraftQueueItem', function(source, id, index, recipeId)
	recipeId = validateInt(recipeId, 1, 1000)
	if not recipeId then return false end

	local left, bench = Inventory(source), CraftingBenches[id]

	if not left then return false end
	if not bench then return false end

	local tbl, craftedItem, craftCount, recipe, ingredientWeight = validateAndPrepare(source, left, bench, recipeId)
	if not tbl or not recipe then return false end

	local craftedItemWeight = (craftedItem.weight + (recipe.metadata?.weight or 0)) * craftCount
	if left.weight + craftedItemWeight - ingredientWeight > left.maxWeight then
		return false, 'cannot_carry'
	end

	if not TriggerEventHooks('craftItem', {
		source = source,
		benchId = id,
		benchIndex = index,
		recipe = recipe,
		toInventory = left.id,
	}) then return false end

	if not consumeIngredients(left, tbl) then return false end

	local refundItems = {}
	for name, needs in pairs(recipe.ingredients) do
		if needs >= 1 then
			refundItems[#refundItems + 1] = { name = name, count = needs }
		end
	end

	pendingCraftCounter += 1
	local pendingId = ('%s_%s_%d_%d'):format(source, recipe.name, pendingCraftCounter, math.random(100000, 999999))

	if not PendingCrafts[source] then
		PendingCrafts[source] = {}
	end

	PendingCrafts[source][pendingId] = {
		state = 'crafting',
		item = craftedItem,
		count = craftCount,
		metadata = recipe.metadata or {},
		refundItems = refundItems,
	}

	local duration = recipe.duration or 3000
	Wait(duration)

	if not PendingCrafts[source] or not PendingCrafts[source][pendingId] then
		return false
	end

	PendingCrafts[source][pendingId].state = 'ready'
	PendingCrafts[source][pendingId].refundItems = nil

	return {
		success = true,
		pendingCraftId = pendingId,
		duration = duration,
	}
end)

---@param playerInv table
---@param toType? string
---@return table|nil targetInv
---@return table|nil backpackItem
local function resolveTargetInventory(playerInv, toType)
	if toType == 'backpack' then
		if not playerInv.openBackpack or not playerInv.backpackSlot then return nil end
		local backpack = Inventory(playerInv.openBackpack)
		if not backpack then return nil end
		return backpack, playerInv.items[playerInv.backpackSlot]
	end
	return playerInv, nil
end

---@param targetInv table
---@param slotItem table
---@param item table Item definition
---@param gx number
---@param gy number
---@param rotated? boolean
local function overrideGridPosition(targetInv, slotItem, item, gx, gy, rotated)
	if not GridUtils.IsGridInventory(targetInv.type) then return end

	gx = math.floor(tonumber(gx) or 0)
	gy = math.floor(tonumber(gy) or 0)
	local gridWidth = targetInv.gridWidth or shared.gridwidth or 12
	local gridHeight = targetInv.gridHeight or shared.gridheight or 5

	if gx < 0 or gy < 0 or gx >= gridWidth or gy >= gridHeight then return end

	local w = item.width or 1
	local h = item.height or 1
	if rotated then w, h = h, w end

	local grid = GridUtils.BuildOccupancy(targetInv, slotItem.slot)
	if GridUtils.CanPlace(grid, gridWidth, gridHeight, gx, gy, w, h) then
		slotItem.gridX = gx
		slotItem.gridY = gy
		slotItem.gridRotated = rotated or false
		targetInv:syncSlotsWithClients({
			{ item = slotItem, inventory = targetInv.id }
		}, true)
	end
end

lib.callback.register('ox_inventory:collectCraftItem', function(source, pendingCraftId, toSlot, toGridX, toGridY, rotated, toType)
	if type(pendingCraftId) ~= 'string' then return false end

	toType = validateToType(toType)
	if toSlot ~= nil then
		toSlot = validateInt(toSlot, 1, 1000)
		if not toSlot then return false end
	end

	local playerInv = Inventory(source)
	if not playerInv then return false end

	if not PendingCrafts[source] or not PendingCrafts[source][pendingCraftId] then
		return false
	end

	local pending = PendingCrafts[source][pendingCraftId]

	if pending.state ~= 'ready' then return false end

	pending.state = 'collected'

	local targetInv, backpackItem = resolveTargetInventory(playerInv, toType)
	if not targetInv then
		pending.state = 'ready'
		return false
	end

	local itemWeight = (pending.item.weight + (pending.metadata?.weight or 0)) * pending.count
	if targetInv.weight + itemWeight > targetInv.maxWeight then
		pending.state = 'ready'
		return false, 'cannot_carry'
	end

	local added, newItem = Inventory.AddItem(targetInv, pending.item, pending.count, pending.metadata, pending.item.stack and toSlot or nil)

	if not added then
		pending.state = 'ready'
		return false
	end

	if toGridX ~= nil and newItem then
		overrideGridPosition(targetInv, newItem, pending.item, toGridX, toGridY, rotated)
	end

	if backpackItem and newItem then
		TriggerClientEvent('ox_inventory:itemNotify', source, { newItem, 'ui_added', pending.count })
	end

	if backpackItem then
		Inventory.ContainerWeight(backpackItem, targetInv.weight, playerInv)
	end

	PendingCrafts[source][pendingCraftId] = nil

	if not next(PendingCrafts[source]) then
		PendingCrafts[source] = nil
	end

	return true
end)

lib.callback.register('ox_inventory:batchCollectCraftItems', function(source, pendingCraftIds, toSlot, toGridX, toGridY, rotated, toType)
	toType = validateToType(toType)
	if toSlot ~= nil then
		toSlot = validateInt(toSlot, 1, 1000)
		if not toSlot then return false end
	end

	if type(pendingCraftIds) ~= 'table' then return false end
	for i = 1, #pendingCraftIds do
		if type(pendingCraftIds[i]) ~= 'string' then return false end
	end

	local playerInv = Inventory(source)
	if not playerInv then return false end

	if not PendingCrafts[source] then return false end
	if #pendingCraftIds == 0 then return false end

	local targetInv, backpackItem = resolveTargetInventory(playerInv, toType)
	if not targetInv then return false end

	local totalCount = 0
	local validPendingIds = {}
	local pendingItem = nil
	local pendingMetadata = nil
	local runningWeight = targetInv.weight

	for _, pendingId in ipairs(pendingCraftIds) do
		local pending = PendingCrafts[source][pendingId]
		if pending and pending.state == 'ready' then
			pending.state = 'collected'
			local itemWeight = (pending.item.weight + (pending.metadata?.weight or 0)) * pending.count
			if runningWeight + itemWeight <= targetInv.maxWeight then
				runningWeight = runningWeight + itemWeight
				totalCount = totalCount + pending.count
				if not pendingItem then
					pendingItem = pending.item
					pendingMetadata = pending.metadata
				end
				validPendingIds[#validPendingIds + 1] = pendingId
			else
				pending.state = 'ready'
			end
		end
	end

	if totalCount == 0 or not pendingItem then
		return { success = false, collectedCount = 0, collectedIds = {} }
	end

	local resolvedSlot = nil
	if pendingItem.stack and toSlot then
		local existingSlotData = targetInv.items[toSlot]
		if existingSlotData then
			if existingSlotData.name == pendingItem.name then
				resolvedSlot = toSlot
			else
				local maxSlot = 0
				for k in pairs(targetInv.items) do
					if type(k) == 'number' and k > maxSlot then maxSlot = k end
				end
				resolvedSlot = maxSlot + 1
			end
		else
			resolvedSlot = toSlot
		end
	end

	local added, newItem = Inventory.AddItem(targetInv, pendingItem, totalCount, pendingMetadata, resolvedSlot)

	if not added then
		for _, pendingId in ipairs(validPendingIds) do
			local p = PendingCrafts[source] and PendingCrafts[source][pendingId]
			if p then p.state = 'ready' end
		end
		return { success = false, collectedCount = 0, collectedIds = {} }
	end

	for _, pendingId in ipairs(validPendingIds) do
		PendingCrafts[source][pendingId] = nil
	end

	local collectedCount = #validPendingIds

	if newItem and toGridX ~= nil then
		local slotObj = newItem.slot and newItem or newItem[1]
		if slotObj then
			overrideGridPosition(targetInv, slotObj, pendingItem, toGridX, toGridY, rotated)
		end
	end

	if backpackItem and newItem then
		local slotObj = newItem.slot and newItem or newItem[1]
		if slotObj then
			TriggerClientEvent('ox_inventory:itemNotify', source, { slotObj, 'ui_added', totalCount })
		end
	end

	if backpackItem then
		Inventory.ContainerWeight(backpackItem, targetInv.weight, playerInv)
	end

	if PendingCrafts[source] and not next(PendingCrafts[source]) then
		PendingCrafts[source] = nil
	end

	return { success = collectedCount > 0, collectedCount = collectedCount, collectedIds = validPendingIds }
end)

local function flushPendingCrafts(source, isDisconnecting)
	if not PendingCrafts[source] then return end

	local left = Inventory(source)
	if not left then
		PendingCrafts[source] = nil
		return
	end

	local readyGroups = {}
	local readyOrder = {}

	for pendingId, pending in pairs(PendingCrafts[source]) do
		if pending.state == 'collected' then
		elseif pending.state == 'crafting' then
			if pending.refundItems then
				for _, refund in ipairs(pending.refundItems) do
					local item = Items(refund.name)
					if item then
						Inventory.AddItem(left, item, refund.count)
					end
				end
			end
		else
			local name = pending.item.name
			if readyGroups[name] then
				readyGroups[name].totalCount = readyGroups[name].totalCount + pending.count
			else
				readyGroups[name] = { item = pending.item, metadata = pending.metadata, totalCount = pending.count }
				readyOrder[#readyOrder + 1] = name
			end
		end
	end

	for _, name in ipairs(readyOrder) do
		local group = readyGroups[name]
		local added = Inventory.AddItem(left, group.item, group.totalCount, group.metadata)

		if not added then
			if isDisconnecting then
				warn(('[ox_inventory] flushPendingCrafts: could not add %s x%d for player %s - item lost'):format(
					name, group.totalCount, source
				))
			else
				local ped = GetPlayerPed(source)
				if ped and ped ~= 0 then
					exports.ox_inventory:CustomDrop('Crafted', {
						{ name, group.totalCount, group.metadata }
					}, GetEntityCoords(ped))
				else
					warn(('[ox_inventory] flushPendingCrafts: could not add or drop %s x%d for player %s'):format(
						name, group.totalCount, source
					))
				end
			end
		end
	end

	PendingCrafts[source] = nil
end

AddEventHandler('playerDropped', function()
	flushPendingCrafts(source, true)
end)

AddEventHandler('ox_inventory:closedInventory', function(source)
	flushPendingCrafts(source, false)
end)

CreateThread(function()
	while true do
		Wait(300000)

		for src in pairs(PendingCrafts) do
			if not GetPlayerName(src) then
				warn(('[ox_inventory] Cleaning stale PendingCrafts for disconnected player %s'):format(src))
				PendingCrafts[src] = nil
			end
		end
	end
end)
