import { Locale } from '../../store/locale';
import React, { useCallback, useRef, useState } from 'react';
import { getScale, setScaleValue, applyScale, MIN_SCALE, MAX_SCALE, STEP, DEFAULT_SCALE } from '../../helpers/uiScale';
import { getNotifyPosition, setNotifyPosition, NotifyPosition } from '../../helpers/notifyPosition';

interface Props {
  infoVisible: boolean;
  setInfoVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const CONTROL_SECTIONS = [
  {
    titleKey: 'ui_controls_general',
    titleFallback: 'General',
    icon: 'mouse',
    controls: [
      { keys: 'RMB', descKey: 'ui_rmb', descFallback: 'Context menu' },
      { keys: 'ALT + LMB', descKey: 'ui_alt_lmb', descFallback: 'Quick use item' },
      { keys: 'CTRL + C', descKey: 'ui_ctrl_c', descFallback: 'Copy serial number' },
    ],
  },
  {
    titleKey: 'ui_controls_moving',
    titleFallback: 'Moving Items',
    icon: 'move',
    controls: [
      { keys: 'CTRL + LMB', descKey: 'ui_ctrl_lmb', descFallback: 'Quick move stack' },
      { keys: 'CTRL + SHIFT + LMB', descKey: 'ui_ctrl_shift_lmb', descFallback: 'Quick move half stack' },
      { keys: 'SHIFT + Drag', descKey: 'ui_shift_drag', descFallback: 'Split quantity' },
    ],
  },
  {
    titleKey: 'ui_controls_grid',
    titleFallback: 'Grid Controls',
    icon: 'grid',
    controls: [
      { keys: 'R', descKey: 'ui_rotate_item', descFallback: 'Rotate while dragging' },
      { keys: '1 - 5', descKey: 'ui_hotbar_assign', descFallback: 'Assign to hotbar' },
    ],
  },
];

const SectionIcon: React.FC<{ type: string }> = ({ type }) => {
  const p = { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'mouse': return <svg {...p}><path d="M12 2a6 6 0 00-6 6v8a6 6 0 0012 0V8a6 6 0 00-6-6z"/><path d="M12 2v8"/></svg>;
    case 'move': return <svg {...p}><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>;
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    default: return null;
  }
};

const NOTIFY_POSITIONS: { value: NotifyPosition; label: string; gridArea: string }[] = [
  { value: 'top-left', label: 'TL', gridArea: '1 / 1' },
  { value: 'top-center', label: 'TC', gridArea: '1 / 2' },
  { value: 'top-right', label: 'TR', gridArea: '1 / 3' },
  { value: 'middle-left', label: 'ML', gridArea: '2 / 1' },
  { value: 'middle-right', label: 'MR', gridArea: '2 / 3' },
  { value: 'bottom-left', label: 'BL', gridArea: '3 / 1' },
  { value: 'bottom-center', label: 'BC', gridArea: '3 / 2' },
  { value: 'bottom-right', label: 'BR', gridArea: '3 / 3' },
];

const UsefulControls: React.FC<Props> = ({ infoVisible, setInfoVisible }) => {
  const [displayPercent, setDisplayPercent] = useState(() => Math.round(getScale() * 100));
  const [showReset, setShowReset] = useState(() => getScale() !== DEFAULT_SCALE);
  const [notifyPos, setNotifyPos] = useState<NotifyPosition>(getNotifyPosition);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking the close button
    if ((e.target as HTMLElement).closest('.uc-close')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setOffset({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [offset]);

  if (!infoVisible) return null;

  const handleInput = () => {
    if (!sliderRef.current) return;
    const val = parseFloat(sliderRef.current.value);
    setScaleValue(val);
    setDisplayPercent(Math.round(val * 100));
    setShowReset(val !== DEFAULT_SCALE);
  };

  const handleCommit = () => {
    applyScale();
  };

  const handleReset = () => {
    setScaleValue(DEFAULT_SCALE);
    applyScale();
    setDisplayPercent(Math.round(DEFAULT_SCALE * 100));
    setShowReset(false);
    if (sliderRef.current) sliderRef.current.value = String(DEFAULT_SCALE);
  };

  const handleNotifyPos = (pos: NotifyPosition) => {
    setNotifyPos(pos);
    setNotifyPosition(pos);
  };

  return (
    <div className="useful-controls-dialog-overlay" onMouseDown={() => setInfoVisible(false)}>
      <div
        className="useful-controls-dialog"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="uc-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
          <div className="uc-header-left">
            <svg className="uc-header-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            <span className="uc-header-title">{Locale.ui_usefulcontrols || 'Controls & Settings'}</span>
          </div>
          <button className="uc-close" onClick={() => setInfoVisible(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="uc-content">
          {CONTROL_SECTIONS.map((section) => (
            <div className="uc-section" key={section.titleKey}>
              <div className="uc-section-label">
                <SectionIcon type={section.icon} />
                {Locale[section.titleKey] || section.titleFallback}
              </div>
              <div className="uc-section-body">
                {section.controls.map((ctrl) => (
                  <div className="uc-row" key={ctrl.descKey}>
                    <span className="uc-desc">{Locale[ctrl.descKey] || ctrl.descFallback}</span>
                    <kbd className="uc-kbd">{ctrl.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="uc-section uc-section--settings">
            <div className="uc-section-label">
              {Locale.ui_settings || 'Settings'}
            </div>

            <div className="uc-setting-row">
              <span className="uc-setting-name">UI Scale</span>
              <div className="uc-scale-control">
                <input
                  ref={sliderRef}
                  className="uc-scale-slider"
                  type="range"
                  min={MIN_SCALE}
                  max={MAX_SCALE}
                  step={STEP}
                  defaultValue={getScale()}
                  onInput={handleInput}
                  onPointerUp={handleCommit}
                  onChange={handleCommit}
                />
                <span className="uc-scale-value">{displayPercent}%</span>
                <button
                  className="uc-scale-reset"
                  onClick={handleReset}
                  style={{ visibility: showReset ? 'visible' : 'hidden' }}
                >Reset</button>
              </div>
            </div>

            <div className="uc-notify-section">
              <span className="uc-setting-name">Item Notifications</span>
              <div className="uc-notify-grid">
                {NOTIFY_POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    className={`uc-notify-cell${notifyPos === p.value ? ' uc-notify-cell--active' : ''}`}
                    style={{ gridArea: p.gridArea }}
                    onClick={() => handleNotifyPos(p.value)}
                    title={p.value}
                  >
                    <span className="uc-notify-dot" />
                  </button>
                ))}
                <div className="uc-notify-center-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8"/><path d="M12 17v4"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsefulControls;
