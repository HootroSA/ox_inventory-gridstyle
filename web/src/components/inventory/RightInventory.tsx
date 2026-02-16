import InventoryGrid from './InventoryGrid';
import GridInventory from './GridInventory';
import CraftingInventory from './CraftingInventory';
import { useAppSelector } from '../../store';
import { selectRightInventory } from '../../store/inventory';
import { isGridInventory } from '../../helpers/gridUtils';

interface Props {
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const RightInventory: React.FC<Props> = ({ onHeaderMouseDown, isLocked, onToggleLock }) => {
  const rightInventory = useAppSelector(selectRightInventory);

  if (rightInventory.type === 'crafting') {
    return <CraftingInventory inventory={rightInventory} onHeaderMouseDown={onHeaderMouseDown} isLocked={isLocked} onToggleLock={onToggleLock} />;
  }

  const canSort = rightInventory.type !== 'player';

  return isGridInventory(rightInventory.type) ? (
    <GridInventory inventory={rightInventory} onHeaderMouseDown={onHeaderMouseDown} isLocked={isLocked} onToggleLock={onToggleLock} canSort={canSort} />
  ) : (
    <InventoryGrid inventory={rightInventory} onHeaderMouseDown={onHeaderMouseDown} isLocked={isLocked} onToggleLock={onToggleLock} />
  );
};

export default RightInventory;
