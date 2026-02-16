import { GridDimensions } from '../typings/grid';

export const DEFAULT_GRID_DIMENSIONS: Record<string, GridDimensions> = {
  player: { gridWidth: 10, gridHeight: 7 },
  stash: { gridWidth: 10, gridHeight: 7 },
  trunk: { gridWidth: 8, gridHeight: 5 },
  glovebox: { gridWidth: 5, gridHeight: 2 },
  container: { gridWidth: 4, gridHeight: 3 },
  backpack: { gridWidth: 5, gridHeight: 4 },
  drop: { gridWidth: 10, gridHeight: 7 },
  newdrop: { gridWidth: 10, gridHeight: 7 },
  dumpster: { gridWidth: 6, gridHeight: 3 },
  policeevidence: { gridWidth: 10, gridHeight: 7 },
  shop: { gridWidth: 10, gridHeight: 7 },
  crafting: { gridWidth: 10, gridHeight: 7 },
};

export const CELL_SIZE_VH = 5.8;
export const GRID_GAP_PX = 2;

export let COMPONENT_SIZE_MODIFIERS: Record<string, { width: number; height: number }> = {
  muzzle: { width: 1, height: 0 },
  barrel: { width: 1, height: 0 },
  sight: { width: 0, height: 1 },
  magazine: { width: 0, height: 1 },
  grip: { width: 0, height: 0 },
  flashlight: { width: 0, height: 0 },
  skin: { width: 0, height: 0 },
};
