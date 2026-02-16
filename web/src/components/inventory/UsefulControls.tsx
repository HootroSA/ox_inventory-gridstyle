import { Locale } from '../../store/locale';
import React from 'react';

interface Props {
  infoVisible: boolean;
  setInfoVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const CONTROL_SECTIONS = [
  {
    titleKey: 'ui_controls_general',
    titleFallback: 'General',
    controls: [
      { keys: 'RMB', descKey: 'ui_rmb', descFallback: 'Open item context menu' },
      { keys: 'ALT + LMB', descKey: 'ui_alt_lmb', descFallback: 'Fast use an item' },
      { keys: 'CTRL + C', descKey: 'ui_ctrl_c', descFallback: 'Copy weapon serial number' },
    ],
  },
  {
    titleKey: 'ui_controls_moving',
    titleFallback: 'Moving Items',
    controls: [
      { keys: 'CTRL + LMB', descKey: 'ui_ctrl_lmb', descFallback: 'Fast move a stack of items into another inventory' },
      { keys: 'CTRL + SHIFT + LMB', descKey: 'ui_ctrl_shift_lmb', descFallback: 'Fast move half a stack of items into another inventory' },
      { keys: 'SHIFT + Drag', descKey: 'ui_shift_drag', descFallback: 'Split item quantity into half' },
    ],
  },
  {
    titleKey: 'ui_controls_grid',
    titleFallback: 'Grid Controls',
    controls: [
      { keys: 'R', descKey: 'ui_rotate_item', descFallback: 'Rotate item while dragging' },
      { keys: '1 - 5', descKey: 'ui_hotbar_assign', descFallback: 'Assign / unassign item to hotbar slot' },
    ],
  },
];

const UsefulControls: React.FC<Props> = ({ infoVisible, setInfoVisible }) => {
  if (!infoVisible) return null;

  return (
    <div className="useful-controls-dialog-overlay" onMouseDown={() => setInfoVisible(false)}>
      <div className="useful-controls-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="uc-header">
          <div className="uc-header-left">
            <svg className="uc-header-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            <span className="uc-header-title">{Locale.ui_usefulcontrols || 'Controls'}</span>
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
                {Locale[section.titleKey] || section.titleFallback}
              </div>
              <div className="uc-section-body">
                {section.controls.map((ctrl) => (
                  <div className="uc-row" key={ctrl.descKey}>
                    <kbd className="uc-kbd">{ctrl.keys}</kbd>
                    <span className="uc-desc">{Locale[ctrl.descKey] || ctrl.descFallback}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsefulControls;
