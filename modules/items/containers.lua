local containers = {}
local backpacks = {}

---@class ItemContainerProperties
---@field slots number
---@field maxWeight number
---@field whitelist? table<string, true> | string[]
---@field blacklist? table<string, true> | string[]

---@class BackpackProperties : ItemContainerProperties
---@field gridWidth? number
---@field gridHeight? number

local function arrayToSet(tbl)
	local size = #tbl
	local set = table.create(0, size)

	for i = 1, size do
		set[tbl[i]] = true
	end

	return set
end

---@param list table?
---@return table?
local function processFilterList(list)
	if not list then return nil end

	local tableType = table.type(list)

	if tableType == 'array' then
		return arrayToSet(list)
	elseif tableType == 'hash' then
		return list
	else
		TypeError('filter list', 'table', type(list))
	end
end

---Registers items with itemName as containers (i.e. backpacks, wallets).
---@param itemName string
---@param properties ItemContainerProperties
---@todo Rework containers for flexibility, improved data structure; then export this method.
local function setContainerProperties(itemName, properties)
	containers[itemName] = {
		size = { properties.slots, properties.maxWeight },
		blacklist = processFilterList(properties.blacklist),
		whitelist = processFilterList(properties.whitelist),
	}
end

---Registers items with itemName as backpacks (third-panel containers).
---Backpacks are also registered as containers for metadata generation.
---All registered backpack items are automatically blacklisted inside backpacks.
---@param itemName string
---@param properties BackpackProperties
local function setBackpackProperties(itemName, properties)
	local blacklist = processFilterList(properties.blacklist) or {}

	for name in pairs(backpacks) do
		blacklist[name] = true
	end

	for _, bp in pairs(backpacks) do
		if bp.blacklist then
			bp.blacklist[itemName] = true
		else
			bp.blacklist = { [itemName] = true }
		end

		if containers[_] then
			containers[_].blacklist = bp.blacklist
		end
	end

	blacklist[itemName] = true

	backpacks[itemName] = {
		size = { properties.slots, properties.maxWeight },
		gridSize = { properties.gridWidth or 5, properties.gridHeight or 4 },
		blacklist = blacklist,
		whitelist = processFilterList(properties.whitelist),
	}

	containers[itemName] = {
		size = { properties.slots, properties.maxWeight },
		blacklist = blacklist,
		whitelist = processFilterList(properties.whitelist),
	}
end

exports('setContainerProperties', setContainerProperties)
exports('RegisterBackpack', setBackpackProperties)

setContainerProperties('paperbag', {
	slots = 5,
	maxWeight = 1000,
	blacklist = { 'testburger' }
})

setContainerProperties('pizzabox', {
	slots = 5,
	maxWeight = 1000,
	whitelist = { 'pizza' }
})

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

return { containers = containers, backpacks = backpacks }
