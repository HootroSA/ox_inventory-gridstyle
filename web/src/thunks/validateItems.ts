import { createAsyncThunk } from '@reduxjs/toolkit';
import { setContainerWeight, setBackpackWeight } from '../store/inventory';
import { fetchNui } from '../utils/fetchNui';

export const validateMove = createAsyncThunk(
  'inventory/validateMove',
  async (
    data: {
      fromSlot: number;
      fromType: string;
      toSlot: number;
      toType: string;
      count: number;
      toGridX?: number;
      toGridY?: number;
      rotated?: boolean;
      targetRotated?: boolean;
    },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const response = await fetchNui<boolean | number>('swapItems', data);

      if (response === false) return rejectWithValue(response);

      if (typeof response === 'number') {
        if (data.fromType === 'backpack' || data.toType === 'backpack') {
          dispatch(setBackpackWeight(response));
        } else {
          dispatch(setContainerWeight(response));
        }
      }
    } catch (error) {
      return rejectWithValue(false);
    }
  }
);
