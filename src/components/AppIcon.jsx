/**
 * Íconos SVG inline (generales) para UI.
 * - Evita requests extra
 * - Permite theming via `currentColor`
 */
export function AppIcon({ name, size = 18, className = '', title }) {
  const resolvedSize =
    typeof size === 'number' || typeof size === 'string'
      ? size
      : 18;
  const common = {
    width: resolvedSize,
    height: resolvedSize,
    className,
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 -960 960 960',
    fill: 'currentColor',
    focusable: false,
    style: { display: 'block' },
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
  };

  const paths = {
    // src/constants/general/close_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    close: 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z',
    // src/constants/general/warning_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    warning:
      'm40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm330.5-51.5Q520-263 520-280t-11.5-28.5Q497-320 480-320t-28.5 11.5Q440-297 440-280t11.5 28.5Q463-240 480-240t28.5-11.5ZM440-360h80v-200h-80v200Zm40-100Z',
    // src/constants/general/info_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    info:
      'M440-280h80v-240h-80v240Zm68.5-331.5Q520-623 520-640t-11.5-28.5Q497-680 480-680t-28.5 11.5Q440-657 440-640t11.5 28.5Q463-600 480-600t28.5-11.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
    // src/constants/general/done_outline_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    done:
      'm381-240 424-424-57-56-368 367-169-170-57 57 227 226Zm0 113L42-466l169-170 170 170 366-367 172 168-538 538Z',
    // src/constants/player/play_arrow_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    play: 'M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z',
    // src/constants/player/pause_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    pause:
      'M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z',
    // src/constants/player/arrow_back_ios_new_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    back: 'M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z',
    // src/constants/player/fast_rewind_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    rewind: 'M860-240 500-480l360-240v480Zm-400 0L100-480l360-240v480Zm-80-240Zm400 0Zm-400 90v-180l-136 90 136 90Zm400 0v-180l-136 90 136 90Z',
    // src/constants/player/fast_forward_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    forward: 'M100-240v-480l360 240-360 240Zm400 0v-480l360 240-360 240ZM180-480Zm400 0Zm-400 90 136-90-136-90v180Zm400 0 136-90-136-90v180Z',
    // src/constants/player/menu_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    menu: 'M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z',
    // src/constants/player/list_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    list: 'M280-600v-80h560v80H280Zm0 160v-80h560v80H280Zm0 160v-80h560v80H280ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z',
    // src/constants/player/lock_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    lock:
      'M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z',
    // src/constants/player/lock_open_right_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    lockOpen:
      'M240-160h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM240-160v-400 400Zm0 80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q83 0 141.5 58.5T920-720h-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z',
    // src/constants/player/subtitles_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
    subtitles:
      'M240-320h320v-80H240v80Zm400 0h80v-80h-80v80ZM240-480h80v-80h-80v80Zm160 0h320v-80H400v80ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z',
    // Material fullscreen icons (no estaban en constants)
    fullscreen:
      'M200-200v-200h80v120h120v80H200Zm0-360v-200h200v80H280v120h-80Zm360 360v-80h120v-120h80v200H560Zm120-360v-120H560v-80h200v200h-80Z',
    fullscreenExit:
      'M200-200v-200h80v120h120v80H200Zm360 0v-80h120v-120h80v200H560ZM200-560v-200h200v80H280v120h-80Zm480 0v-120H560v-80h200v200h-80Z',
  };

  const d = paths[name];
  if (!d) return null;

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}

export default AppIcon;

