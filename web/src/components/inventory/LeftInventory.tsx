import InventoryGrid from './InventoryGrid';
import GridInventory from './GridInventory';
import { useAppSelector } from '../../store';
import { selectLeftInventory } from '../../store/inventory';
import { isGridInventory } from '../../helpers/gridUtils';

interface Props {
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const LeftInventory: React.FC<Props> = ({ onHeaderMouseDown, isLocked, onToggleLock }) => {
  const leftInventory = useAppSelector(selectLeftInventory);

  return isGridInventory(leftInventory.type) ? (
    <GridInventory inventory={leftInventory} onHeaderMouseDown={onHeaderMouseDown} isLocked={isLocked} onToggleLock={onToggleLock} />
  ) : (
    <InventoryGrid inventory={leftInventory} onHeaderMouseDown={onHeaderMouseDown} isLocked={isLocked} onToggleLock={onToggleLock} />
  );
};

export default LeftInventory;
