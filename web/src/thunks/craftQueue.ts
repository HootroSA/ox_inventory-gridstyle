import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchNui } from '../utils/fetchNui';

export const startCraftQueueItem = createAsyncThunk(
  'crafting/startCraftQueueItem',
  async (
    data: {
      queueId: string;
      recipeSlot: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetchNui<
        | {
            success: boolean;
            pendingCraftId: string;
            duration: number;
          }
        | false
      >('startCraftQueueItem', {
        fromSlot: data.recipeSlot,
      });

      if (!response) {
        return rejectWithValue({ queueId: data.queueId, error: 'Crafting failed' });
      }

      return { queueId: data.queueId, ...response };
    } catch (error) {
      return rejectWithValue({ queueId: data.queueId, error: 'Crafting failed' });
    }
  }
);

export const collectCraftItem = createAsyncThunk(
  'crafting/collectCraftItem',
  async (
    data: {
      queueId: string;
      pendingCraftId: string;
      toSlot: number;
      toGridX?: number;
      toGridY?: number;
      rotated?: boolean;
      toType?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetchNui<boolean>('collectCraftItem', {
        pendingCraftId: data.pendingCraftId,
        toSlot: data.toSlot,
        toGridX: data.toGridX,
        toGridY: data.toGridY,
        rotated: data.rotated,
        toType: data.toType,
      });

      if (response === false) {
        return rejectWithValue({ queueId: data.queueId });
      }

      return { queueId: data.queueId };
    } catch (error) {
      return rejectWithValue({ queueId: data.queueId });
    }
  }
);

export const batchCollectCraftItems = createAsyncThunk(
  'crafting/batchCollectCraftItems',
  async (
    data: {
      queueId: string;
      pendingCraftIds: string[];
      toSlot: number;
      toGridX?: number;
      toGridY?: number;
      rotated?: boolean;
      toType?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetchNui<{ success: boolean; collectedCount: number; collectedIds: string[] } | false>(
        'batchCollectCraftItems',
        {
          pendingCraftIds: data.pendingCraftIds,
          toSlot: data.toSlot,
          toGridX: data.toGridX,
          toGridY: data.toGridY,
          rotated: data.rotated,
          toType: data.toType,
        }
      );

      if (!response || !response.success) {
        return rejectWithValue({ queueId: data.queueId });
      }

      return { queueId: data.queueId, collectedCount: response.collectedCount, collectedIds: response.collectedIds || [] };
    } catch (error) {
      return rejectWithValue({ queueId: data.queueId });
    }
  }
);
