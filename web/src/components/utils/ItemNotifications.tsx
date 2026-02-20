import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TransitionGroup } from 'react-transition-group';
import useNuiEvent from '../../hooks/useNuiEvent';
import useQueue from '../../hooks/useQueue';
import { Locale } from '../../store/locale';
import { getItemUrl } from '../../helpers';
import { SlotWithItem } from '../../typings';
import { Items } from '../../store/items';
import Fade from './transitions/Fade';
import { getNotifyPosition, subscribeNotifyPosition, stacksUpward, NotifyPosition } from '../../helpers/notifyPosition';

interface ItemNotificationProps {
  item: SlotWithItem;
  text: string;
}

export const ItemNotificationsContext = React.createContext<{
  add: (item: ItemNotificationProps) => void;
} | null>(null);

export const useItemNotifications = () => {
  const itemNotificationsContext = useContext(ItemNotificationsContext);
  if (!itemNotificationsContext) throw new Error(`ItemNotificationsContext undefined`);
  return itemNotificationsContext;
};

const ItemNotification = React.forwardRef(
  (props: { item: ItemNotificationProps; style?: React.CSSProperties }, ref: React.ForwardedRef<HTMLDivElement>) => {
    const slotItem = props.item.item;
    const label = slotItem.metadata?.label || Items[slotItem.name]?.label || slotItem.name;

    return (
      <div className="item-notify" ref={ref} style={props.style}>
        <div className="item-notify-image" style={{ backgroundImage: `url(${getItemUrl(slotItem) || 'none'})` }} />
        <div className="item-notify-content">
          <span className="item-notify-label">{label}</span>
          <span className="item-notify-action">{props.item.text}</span>
        </div>
      </div>
    );
  }
);

const POSITION_STYLES: Record<NotifyPosition, React.CSSProperties> = {
  'top-left': { top: '3vh', left: '3vh', alignItems: 'flex-start' },
  'top-center': { top: '3vh', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  'top-right': { top: '3vh', right: '3vh', alignItems: 'flex-end' },
  'middle-left': { top: '50%', left: '3vh', transform: 'translateY(-50%)', alignItems: 'flex-start' },
  'middle-right': { top: '50%', right: '3vh', transform: 'translateY(-50%)', alignItems: 'flex-end' },
  'bottom-left': { bottom: '3vh', left: '3vh', alignItems: 'flex-start' },
  'bottom-center': { bottom: '14vh', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  'bottom-right': { bottom: '3vh', right: '3vh', alignItems: 'flex-end' },
};

export const ItemNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [position, setPosition] = useState<NotifyPosition>(getNotifyPosition);

  useEffect(() => {
    return subscribeNotifyPosition(setPosition);
  }, []);

  const queue = useQueue<{
    id: number;
    item: ItemNotificationProps;
    ref: React.RefObject<HTMLDivElement>;
  }>();

  const add = (item: ItemNotificationProps) => {
    const ref = React.createRef<HTMLDivElement>();
    const notification = { id: Date.now(), item, ref: ref };

    queue.add(notification);

    const timeout = setTimeout(() => {
      queue.remove();
      clearTimeout(timeout);
    }, 2500);
  };

  useNuiEvent<[item: SlotWithItem, text: string, count?: number]>('itemNotify', ([item, text, count]) => {
    add({ item: item, text: count ? `${Locale[text]} ${count}x` : `${Locale[text]}` });
  });

  const upward = stacksUpward(position);
  const posStyle = POSITION_STYLES[position];

  return (
    <ItemNotificationsContext.Provider value={{ add }}>
      {children}
      {createPortal(
        <TransitionGroup
          className={`item-notify-container${upward ? ' item-notify-container--upward' : ''}`}
          style={posStyle}
        >
          {queue.values.map((notification, index) => (
            <Fade key={`item-notification-${index}`}>
              <ItemNotification item={notification.item} ref={notification.ref} />
            </Fade>
          ))}
        </TransitionGroup>,
        document.body
      )}
    </ItemNotificationsContext.Provider>
  );
};
