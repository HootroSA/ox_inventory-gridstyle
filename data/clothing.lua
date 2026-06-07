-- DayZ-style clothing-as-item configuration.
--
-- Map every clothing item name to the ped slot it changes. Drag the item onto
-- the matching equipment slot and the character is dressed automatically through
-- illenium-appearance. Add a line per clothing item and it just works.
--
-- Use ONE of:
--   component = <id>  -> ped component (clothes worn on the body)
--   prop      = <id>  -> ped prop (worn accessories like hats)
-- plus drawable/texture (0-indexed GTA values for the freemode ped).
--
--   component  1 = mask        -> slot "mask"
--   component  4 = legs/pants  -> slot "pants"   (Hlače)
--   component  6 = shoes       -> slot "shoes"   (Obuća)
--   component  8 = undershirt  -> slot "shirt"   (Majica)
--   component  9 = body armor  -> slot "vest"    (Prsluk)
--   component 11 = top/jacket  -> slot "jacket"  (Jakna)
--   prop       0 = headwear    -> slot "hat"     (Kapa)

return {
	-- Hats / headwear (prop 0)
	['cap']      = { prop = 0,      drawable = 1,  texture = 0 },
	['beanie']   = { prop = 0,      drawable = 2,  texture = 0 },
	['helmet']   = { prop = 0,      drawable = 11, texture = 0 },

	-- Shirts / undershirt (component 8)
	['tshirt']   = { component = 8,  drawable = 15, texture = 0 },
	['shirt']    = { component = 8,  drawable = 3,  texture = 0 },

	-- Jackets / tops (component 11)
	['jacket']   = { component = 11, drawable = 4,  texture = 0 },
	['hoodie']   = { component = 11, drawable = 11, texture = 0 },

	-- Vests / body armor (component 9)
	['vest']          = { component = 9, drawable = 1, texture = 0 },
	['plate_carrier'] = { component = 9, drawable = 5, texture = 0 },

	-- Pants (component 4)
	['pants']    = { component = 4,  drawable = 1,  texture = 0 },
	['jeans']    = { component = 4,  drawable = 6,  texture = 0 },

	-- Shoes (component 6)
	['shoes']    = { component = 6,  drawable = 1,  texture = 0 },
	['boots']    = { component = 6,  drawable = 12, texture = 0 },
}
