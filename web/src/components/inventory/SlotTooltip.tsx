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

  return (
    <div style={{ ...style }} className={`tooltip-wrapper${isShop ? ' tooltip-wrapper--shop' : ''}`} ref={ref}>
      {/* Header: icon + name + type/price badge */}
      <div className={`tooltip-header-wrapper${isShop ? ' tooltip-header--shop' : ''}`}>
        <div className="tooltip-header-left">
          <img src={imageUrl} alt="" className="tooltip-item-image" />
          <div className="tooltip-header-info">
            <span className="tooltip-item-name">{item.metadata?.label || itemData.label || item.name}</span>
            <span className="tooltip-item-type">
              {isShop ? 'Shop Item' : isCraft ? 'Recipe' : item.metadata?.type || (Locale.ui_item || 'Item')}
            </span>
          </div>
        </div>
        {!isShop && <span className="tooltip-weight-badge">{weightDisplay}</span>}
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

      {/* Shop: price & stock details */}
      {isShop && (
        <div className="tooltip-shop-details">
          <div className="tooltip-shop-row">
            <span className="tooltip-shop-label">Stock</span>
            <span className={`tooltip-shop-value${stockCount === 0 ? ' tooltip-shop-value--sold' : ''}`}>
              {stockCount === 0 ? 'SOLD OUT' : stockCount !== undefined ? `${stockCount} in stock` : 'In stock'}
            </span>
          </div>
          <div className="tooltip-shop-row">
            <span className="tooltip-shop-label">Weight</span>
            <span className="tooltip-shop-value">{weightDisplay}</span>
          </div>
          {currencyLabel && (
            <div className="tooltip-shop-row">
              <span className="tooltip-shop-label">Currency</span>
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
      {!isShop && !isCraft && (
        <div className="tooltip-details">
          {item.durability !== undefined && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ui_durability || 'Durability'}:</span>
              <span className="tooltip-detail-value">{Math.trunc(item.durability)}%</span>
            </div>
          )}
          {item.metadata?.ammo !== undefined && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ui_ammo || 'Ammo'}:</span>
              <span className="tooltip-detail-value">{item.metadata.ammo}</span>
            </div>
          )}
          {ammoName && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ammo_type || 'Ammo Type'}:</span>
              <span className="tooltip-detail-value">{ammoName}</span>
            </div>
          )}
          {item.metadata?.serial && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ui_serial || 'Serial'}:</span>
              <span className="tooltip-detail-value tooltip-detail-mono">{item.metadata.serial}</span>
            </div>
          )}
          {item.metadata?.components && item.metadata?.components[0] && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ui_components || 'Components'}:</span>
              <span className="tooltip-detail-value">
                {(item.metadata?.components).map((component: string, index: number, array: []) =>
                  index + 1 === array.length ? Items[component]?.label : Items[component]?.label + ', '
                )}
              </span>
            </div>
          )}
          {item.metadata?.weapontint && (
            <div className="tooltip-detail-row">
              <span className="tooltip-detail-label">{Locale.ui_tint || 'Tint'}:</span>
              <span className="tooltip-detail-value">{item.metadata.weapontint}</span>
            </div>
          )}
          {additionalMetadata.map((data: { metadata: string; value: string }, index: number) => (
            <Fragment key={`metadata-${index}`}>
              {item.metadata && item.metadata[data.metadata] && (
                <div className="tooltip-detail-row">
                  <span className="tooltip-detail-label">{data.value}:</span>
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
