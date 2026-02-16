export type CraftQueueItemStatus = 'queued' | 'crafting' | 'done';

export interface CraftQueueItem {
  queueId: string;
  recipeSlot: number;
  itemName: string;
  label: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status: CraftQueueItemStatus;
  duration: number;
  craftStartedAt: number | null;
  pendingCraftIds: string[];
  error?: string;
}
