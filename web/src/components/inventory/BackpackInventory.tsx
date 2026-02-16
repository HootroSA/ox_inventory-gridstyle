import GridInventory from './GridInventory';
import { useAppSelector, useAppDispatch } from '../../store';
import { selectBackpackInventory, closeBackpack } from '../../store/inventory';
import { fetchNui } from '../../utils/fetchNui';

interface Props {
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const BackpackInventory: React.FC<Props> = ({ onHeaderMouseDown, isLocked, onToggleLock }) => {
  const backpackInventory = useAppSelector(selectBackpackInventory);
  const dispatch = useAppDispatch();

  const handleClose = () => {
    fetchNui('closeBackpack');
    dispatch(closeBackpack());
  };

  return (
    <GridInventory
      inventory={backpackInventory}
      onHeaderMouseDown={onHeaderMouseDown}
      isLocked={isLocked}
      onToggleLock={onToggleLock}
      onClose={handleClose}
    />
  );
};

export default BackpackInventory;
