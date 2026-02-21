import { Inventory, SlotWithItem } from '../../typings';
import React, { Fragment, useMemo } from 'react';
import { Items } from '../../store/items';
import { Locale } from '../../store/locale';
import ReactMarkdown from 'react-markdown';
import { useAppSelector } from '../../store';
import ClockIcon from '../utils/icons/ClockIcon';
import { getItemUrl, isSlotWithItem } from '../../helpers';

const SlotTooltip: React.ForwardRefRenderFunction<
  HTMLDivElement,
  { item: SlotWithItem; inventoryType: Inventory['type']; style: React.CSSProperties }
> = ({ item, inventoryType, style }, ref) => {
  const additionalMetadata = useAppSelector((state) => state.inventory.additionalMetadata);
  const itemData = useMemo(() => Items[item.name], [item]);
  const ingredients = useMemo(() => {
    if (!item.ingredients) return null;
    return Object.entries(item.ingredients).sort((a, b) => a[1] - b[1]);
  }, [item]);
  const description = item.metadata?.description || itemData?.description;
  const ammoName = itemData?.ammoName && Items[itemData?.ammoName]?.label;
  const itemRarity = itemData?.rarity;
  const imageUrl = getItemUrl(item) || 'none';

  const weightDisplay = item.weight > 0
    ? item.weight >= 1000
      ? `${(item.weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 0 })}kg`
      : `${item.weight}g`
    : '0g';

  const isShop = inventoryType === 'shop';
  const isCraft = inventoryType === 'crafting';

  const playerItems = useAppSelector((state) => state.inventory.leftInventory.items);
  const ingredientAvailability = useMemo(() => {
    if (!isCraft || !ingredients) return null;
    const availability: Record<string, { have: number; need: number; sufficient: boolean }> = {};
    for (const [name, count] of ingredients) {
      let have = 0;
      for (const slot of playerItems) {
        if (isSlotWithItem(slot) && slot.name === name) {
          have += slot.count;
        }
      }
      availability[name] = { have, need: count, sufficient: count < 1 || have >= count };
    }
    return availability;
  }, [isCraft, ingredients, playerItems]);

  const priceDisplay = item.price !== undefined && item.price > 0
    ? item.price.toLocaleString('en-us')
    : null;
  const currencyLabel =
    item.currency === 'black_money' ? 'Black Money' :
    item.currency && item.currency !== 'money' ? Items[item.currency]?.label || item.currency :
    null;
  const isBlackMoney = item.currency === 'black_money';
  const isItemCurrency = item.currency && item.currency !== 'money' && item.currency !== 'black_money';
  const stockCount = isShop ? item.count : null;

  const hasDetails = !isShop && !isCraft && (
    item.durability !== undefined ||
    item.metadata?.ammo !== undefined ||
    ammoName ||
    item.metadata?.serial ||
    (item.metadata?.components && item.metadata?.components[0]) ||
    item.metadata?.weapontint
  );

  if (!itemData) {
    return (
      <div className="tooltip-wrapper" ref={ref} style={style}>
        <div className="tooltip-header-wrapper">
          <div className="tooltip-header-left">
            <img src={imageUrl} alt="" className="tooltip-item-image" />
            <span className="tooltip-item-name">{item.name}</span>
          </div>
        </div>
      </div>
    );
  }

  const wrapperClass = [
    'tooltip-wrapper',
    isShop && 'tooltip-wrapper--shop',
    isCraft && 'tooltip-wrapper--craft',
    itemRarity && `tooltip-wrapper--${itemRarity}`,
  ].filter(Boolean).join(' ');

  return (
    <div style={{ ...style }} className={wrapperClass} ref={ref}>
      {/* Rarity accent bar */}
      {itemRarity && <div className={`tooltip-rarity-bar tooltip-rarity-bar--${itemRarity}`} />}

      {/* Header: icon + name + type | badges */}
      <div className={`tooltip-header-wrapper${isShop ? ' tooltip-header--shop' : ''}`}>
        <div className="tooltip-header-left">
          <div className={`tooltip-item-image-wrap${itemRarity ? ` tooltip-img--${itemRarity}` : ''}`}>
            <img src={imageUrl} alt="" className="tooltip-item-image" />
          </div>
          <div className="tooltip-header-info">
            <span className="tooltip-item-name">{item.metadata?.label || itemData.label || item.name}</span>
            <span className="tooltip-item-type">
              {isShop ? 'Shop Item' : isCraft ? 'Recipe' : item.metadata?.type || (
                itemData.weapon ? 'Weapon' :
                itemData.component ? 'Attachment' :
                (itemData as any).ammo ? 'Ammunition' :
                (itemData as any).tint ? 'Weapon Tint' :
                Locale.ui_item || 'Item'
              )}
            </span>
          </div>
        </div>
        <div className="tooltip-header-badges">
          {itemRarity && (
            <span className={`tooltip-rarity-badge tooltip-rarity-badge--${itemRarity}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {Locale[`rarity_${itemRarity}` as keyof typeof Locale] || itemRarity}
            </span>
          )}
          {!isShop && (
            <span className="tooltip-weight-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
              {weightDisplay}
            </span>
          )}
          {isShop && priceDisplay && (
            <span className={`tooltip-price-badge${isBlackMoney ? ' tooltip-price-badge--dirty' : ''}`}>
              {isItemCurrency ? (
                <>
                  <img src={getItemUrl(item.currency!)} alt="" className="tooltip-price-currency-icon" />
                  {priceDisplay}
                </>
              ) : (
                <>{Locale.$ || '$'}{priceDisplay}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Shop: price & stock details */}
      {isShop && (
        <div className="tooltip-shop-details">
          <div className="tooltip-shop-row">
            <span className="tooltip-shop-label">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
                <circle cx="18" cy="16" r="2"/>
              </svg>
              Stock
            </span>
            <span className={`tooltip-shop-value${stockCount === 0 ? ' tooltip-shop-value--sold' : ''}`}>
              {stockCount === 0 ? 'SOLD OUT' : stockCount !== undefined ? `${stockCount} in stock` : 'In stock'}
            </span>
          </div>
          <div className="tooltip-shop-row">
            <span className="tooltip-shop-label">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a4 4 0 00-4 4c0 2 2 4 4 8 2-4 4-6 4-8a4 4 0 00-4-4z"/>
                <path d="M5 21h14"/>
              </svg>
              Weight
            </span>
            <span className="tooltip-shop-value">{weightDisplay}</span>
          </div>
          {currencyLabel && (
            <div className="tooltip-shop-row">
              <span className="tooltip-shop-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 9h8M8 15h6"/>
                </svg>
                Currency
              </span>
              <span className={`tooltip-shop-value${isBlackMoney ? ' tooltip-shop-value--dirty' : ''}`}>{currencyLabel}</span>
            </div>
          )}
          <div className="tooltip-shop-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/>
            </svg>
            <span>Drag to inventory to purchase</span>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="tooltip-description">
          <ReactMarkdown className="tooltip-markdown">{description}</ReactMarkdown>
        </div>
      )}

      {/* Item details (non-shop, non-crafting) */}
      {hasDetails && (
        <div className="tooltip-details">
          {item.durability !== undefined && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                {Locale.ui_durability || 'Durability'}
              </span>
              <div className="tooltip-durability-wrap">
                <div className="tooltip-durability-bar">
                  <div
                    className="tooltip-durability-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.durability))}%`,
                      background: item.durability > 50
                        ? `rgba(74, 222, 128, 0.7)`
                        : item.durability > 20
                        ? `rgba(251, 191, 36, 0.7)`
                        : `rgba(248, 113, 113, 0.7)`,
                    }}
                  />
                </div>
                <span className="tooltip-detail-value">{Math.trunc(item.durability)}%</span>
              </div>
            </div>
          )}
          {item.metadata?.ammo !== undefined && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="2" width="8" height="16" rx="2"/><path d="M12 2v-0"/><rect x="9" y="18" width="6" height="4" rx="1"/>
                </svg>
                {Locale.ui_ammo || 'Ammo'}
              </span>
              <span className="tooltip-detail-value">{item.metadata.ammo}</span>
            </div>
          )}
          {ammoName && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="2" width="5" height="14" rx="2"/><rect x="7" y="16" width="3" height="4" rx="0.5"/><rect x="14" y="5" width="5" height="11" rx="2"/><rect x="15" y="16" width="3" height="4" rx="0.5"/>
                </svg>
                {Locale.ammo_type || 'Ammo Type'}
              </span>
              <span className="tooltip-detail-value">{ammoName}</span>
            </div>
          )}
          {item.metadata?.serial && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                {Locale.ui_serial || 'Serial'}
              </span>
              <span className="tooltip-detail-value tooltip-detail-mono">{item.metadata.serial}</span>
            </div>
          )}
          {item.metadata?.components && item.metadata?.components[0] && (
            <div className="tooltip-components">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                {Locale.ui_components || 'Attachments'}
              </span>
              <div className="tooltip-components-list">
                {(item.metadata.components).map((component: string) => (
                  <div className="tooltip-component-chip" key={component}>
                    <img src={getItemUrl(component) || 'none'} alt="" />
                    <span>{Items[component]?.label || component}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {item.metadata?.weapontint && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="13.5" cy="6.5" r="2.5"/><path d="M17 2l4 4-9.5 9.5L8 12z"/><path d="M2 22l5.5-1.5L4 17z"/>
                </svg>
                {Locale.ui_tint || 'Tint'}
              </span>
              <span className="tooltip-detail-value">{item.metadata.weapontint}</span>
            </div>
          )}
          {additionalMetadata.map((data: { metadata: string; value: string }, index: number) => (
            <Fragment key={`metadata-${index}`}>
              {item.metadata && item.metadata[data.metadata] && (
                <div className="tooltip-detail-row">
                  <span className="tooltip-detail-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    {data.value}
                  </span>
                  <span className="tooltip-detail-value">{item.metadata[data.metadata]}</span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {/* Crafting details */}
      {isCraft && (
        <>
          <div className="tooltip-crafting-duration">
            <ClockIcon />
            <span>{(item.duration !== undefined ? item.duration : 3000) / 1000}s</span>
          </div>
          <div className="tooltip-ingredients">
            {ingredients &&
              ingredients.map((ingredient) => {
                const [ingredientName, count] = [ingredient[0], ingredient[1]];
                const avail = ingredientAvailability?.[ingredientName];
                const isSufficient = avail?.sufficient ?? true;
                return (
                  <div className={`tooltip-ingredient${isSufficient ? ' tooltip-ingredient--available' : ' tooltip-ingredient--missing'}`} key={`ingredient-${ingredientName}`}>
                    <img src={ingredientName ? getItemUrl(ingredientName) : 'none'} alt="" />
                    <span>
                      {count >= 1
                        ? `${count}x ${Items[ingredientName]?.label || ingredientName}`
                        : count === 0
                        ? `${Items[ingredientName]?.label || ingredientName}`
                        : count < 1 && `${count * 100}% ${Items[ingredientName]?.label || ingredientName}`}
                    </span>
                    {count >= 1 && avail && (
                      <span className="tooltip-ingredient-count">{avail.have}/{avail.need}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};

export default React.forwardRef(SlotTooltip);
