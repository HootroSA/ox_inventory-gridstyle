return {
	-- 0	vehicle has no storage
	-- 1	vehicle has no trunk storage
	-- 2	vehicle has no glovebox storage
	-- 3	vehicle has trunk in the hood
	Storage = {
		[`jester`] = 3,
		[`adder`] = 3,
		[`osiris`] = 1,
		[`pfister811`] = 1,
		[`penetrator`] = 1,
		[`autarch`] = 1,
		[`bullet`] = 1,
		[`cheetah`] = 1,
		[`cyclone`] = 1,
		[`voltic`] = 1,
		[`reaper`] = 3,
		[`entityxf`] = 1,
		[`t20`] = 1,
		[`taipan`] = 1,
		[`tezeract`] = 1,
		[`torero`] = 3,
		[`turismor`] = 1,
		[`fmj`] = 1,
		[`infernus`] = 1,
		[`italigtb`] = 3,
		[`italigtb2`] = 3,
		[`nero2`] = 1,
		[`vacca`] = 3,
		[`vagner`] = 1,
		[`visione`] = 1,
		[`prototipo`] = 1,
		[`zentorno`] = 1,
		[`trophytruck`] = 0,
		[`trophytruck2`] = 0,
	},

	-- Vehicle storage config: { gridWidth, gridHeight, maxWeight }
	-- The grid defines how big the inventory is visually and how many items fit.
	-- Priority: per-model > per-class > fallback defaults.
	--
	-- To override a specific vehicle:
	--   models = { [`adder`] = { gridWidth = 4, gridHeight = 2, maxWeight = 10000 } }

	glovebox = {
		[0]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Compact
		[1]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Sedan
		[2]  = { gridWidth = 5, gridHeight = 2, maxWeight = 88000 },	-- SUV
		[3]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Coupe
		[4]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Muscle
		[5]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Sports Classic
		[6]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Sports
		[7]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Super
		[8]  = { gridWidth = 3, gridHeight = 1, maxWeight = 40000 },	-- Motorcycle
		[9]  = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Offroad
		[10] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Industrial
		[11] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Utility
		[12] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Van
		[14] = { gridWidth = 5, gridHeight = 3, maxWeight = 248000 },	-- Boat
		[15] = { gridWidth = 5, gridHeight = 3, maxWeight = 248000 },	-- Helicopter
		[16] = { gridWidth = 6, gridHeight = 4, maxWeight = 408000 },	-- Plane
		[17] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Service
		[18] = { gridWidth = 5, gridHeight = 2, maxWeight = 88000 },	-- Emergency
		[19] = { gridWidth = 5, gridHeight = 2, maxWeight = 88000 },	-- Military
		[20] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },	-- Commercial
		models = {
			[`xa21`] = { gridWidth = 4, gridHeight = 2, maxWeight = 88000 },
		}
	},

	trunk = {
		[0]  = { gridWidth = 6, gridHeight = 3, maxWeight = 168000 },	-- Compact
		[1]  = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },	-- Sedan
		[2]  = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },	-- SUV
		[3]  = { gridWidth = 6, gridHeight = 4, maxWeight = 248000 },	-- Coupe
		[4]  = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },	-- Muscle
		[5]  = { gridWidth = 6, gridHeight = 3, maxWeight = 248000 },	-- Sports Classic
		[6]  = { gridWidth = 6, gridHeight = 3, maxWeight = 248000 },	-- Sports
		[7]  = { gridWidth = 5, gridHeight = 2, maxWeight = 168000 },	-- Super
		[8]  = { gridWidth = 3, gridHeight = 1, maxWeight = 40000 },	-- Motorcycle
		[9]  = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },	-- Offroad
		[10] = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },	-- Industrial
		[11] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },	-- Utility
		[12] = { gridWidth = 9, gridHeight = 6, maxWeight = 488000 },	-- Van
		-- [14] -- Boat
		-- [15] -- Helicopter
		-- [16] -- Plane
		[17] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },	-- Service
		[18] = { gridWidth = 7, gridHeight = 4, maxWeight = 328000 },	-- Emergency
		[19] = { gridWidth = 8, gridHeight = 5, maxWeight = 408000 },	-- Military
		[20] = { gridWidth = 10, gridHeight = 6, maxWeight = 488000 },	-- Commercial
		models = {
			[`xa21`] = { gridWidth = 4, gridHeight = 2, maxWeight = 10000 },
			[`sultan`] = { gridWidth = 5, gridHeight = 5, maxWeight = 88000 },
		},
	}
}
