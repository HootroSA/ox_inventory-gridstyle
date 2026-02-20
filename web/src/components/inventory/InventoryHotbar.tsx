import React, { useState } from 'react';
import { getItemUrl, isSlotWithItem } from '../../helpers';
import useNuiEvent from '../../hooks/useNuiEvent';
import { Items } from '../../store/items';
import WeightBar from '../utils/WeightBar';
import { useAppSelector } from '../../store';
import { selectLeftInventory, selectHotbar } from '../../store/inventory';
import SlideUp from '../utils/transitions/SlideUp';

const InventoryHotbar: React.FC = () => {
  const [hotbarVisible, setHotbarVisible] = useState(false);
  const leftInventory = useAppSelector(selectLeftInventory);
  const hotbar = useAppSelector(selectHotbar);

  const hotbarItems = hotbar.map((slotId) => {
    if (slotId === null) return null;
    const item = leftInventory.items.find((i) => i != null && i.slot === slotId);
    return item && isSlotWithItem(item) ? item : null;
  });

  const [handle, setHandle] = useState<NodeJS.Timeout>();
  useNuiEvent('toggleHotbar', () => {
    if (hotbarVisible) {
      setHotbarVisible(false);
    } else {
      if (handle) clearTimeout(handle);
      setHotbarVisible(true);
      setHandle(setTimeout(() => setHotbarVisible(false), 3000));
    }
  });

  return (
    <SlideUp in={hotbarVisible}>
      <div className="hotbar-container">
        <div className="hotbar-bar">
          <div className="hotbar-bar-accent" />
          <div className="hotbar-slots">
            {hotbarItems.map((item, index) => (
              <div
                className={`hotbar-slot${item ? ' hotbar-slot--filled' : ' hotbar-slot--empty'}`}
                key={`hotbar-${index}`}
              >
                {item ? (
                  <>
                    <div className="hotbar-slot-image" style={{ backgroundImage: `url(${getItemUrl(item)})` }} />
                    <div className="hotbar-slot-key">{index + 1}</div>
                    {item.count > 1 && (
                      <div className="hotbar-slot-meta">
                        <span className="hotbar-slot-count">{item.count}x</span>
                      </div>
                    )}
                    <div className="hotbar-slot-bottom">
                      {item.durability !== undefined && <WeightBar percent={item.durability} durability />}
                      <div className="hotbar-slot-label">
                        {item.metadata?.label || Items[item.name]?.label || item.name}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="hotbar-slot-empty-num">{index + 1}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideUp>
  );
};

export default InventoryHotbar;
