-- DayZ-style clothing-as-item configuration.
--
-- Map every clothing item name to the ped component it changes and the
-- drawable/texture that gets applied when it is equipped into its slot.
--
--   component 11 = top / jacket   -> slot "top"   (Majica / Jakna)
--   component  9 = body armor     -> slot "vest"  (Prsluk)
--   component  4 = legs / pants   -> slot "pants" (Hlače)
--
-- Drag the item onto the matching equipment slot and the character is dressed
-- automatically through illenium-appearance. Add a line here for each new
-- clothing item and it just works. Drawable/texture are 0-indexed GTA values
-- for the freemode ped; tweak them to whatever look you want per item.

return {
	-- Tops / jackets (component 11)
	['jacket']   = { component = 11, drawable = 4,  texture = 0 },
	['tshirt']   = { component = 11, drawable = 7,  texture = 0 },
	['hoodie']   = { component = 11, drawable = 11, texture = 0 },

	-- Vests / body armor (component 9)
	['vest']     = { component = 9,  drawable = 1,  texture = 0 },
	['plate_carrier'] = { component = 9, drawable = 5, texture = 0 },

	-- Pants (component 4)
	['pants']    = { component = 4,  drawable = 1,  texture = 0 },
	['jeans']    = { component = 4,  drawable = 6,  texture = 0 },
	['shorts']   = { component = 4,  drawable = 14, texture = 0 },
}
