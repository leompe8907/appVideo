import { renderPlayerHudButton } from './renderPlayerHudButton.jsx';

/**
 * @param {object} props
 * @param {object} props.layout — { top: { left, center, right }, bottom }
 * @param {import('./renderPlayerHudButton.jsx').PlayerHudButtonContext} props.ctx
 * @param {boolean} props.showPlaybackButtons
 */
export function PlayerHudTopBar({ layout, ctx, showPlaybackButtons }) {
  const top = layout?.top || { left: [], center: [], right: [] };
  return (
    <div className="player-hud__topbar">
      <div className="player-hud__topbar-left" data-tv-nav-zone="player-top-left">
        {top.left.map((key) => renderPlayerHudButton(key, ctx))}
      </div>

      {showPlaybackButtons ? (
        <div className="player-hud__topbar-center" data-tv-nav-zone="player-top-center">
          {top.center.map((key) => renderPlayerHudButton(key, ctx))}
        </div>
      ) : (
        <div className="player-hud__topbar-center" />
      )}

      <div className="player-hud__topbar-right">
        {top.right.map((key) => renderPlayerHudButton(key, ctx))}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string[]} props.bottomKeys
 * @param {import('./renderPlayerHudButton.jsx').PlayerHudButtonContext} props.ctx
 */
export function PlayerHudBottomActions({ bottomKeys, ctx }) {
  const keys = Array.isArray(bottomKeys) ? bottomKeys : [];
  const nodes = keys.map((key) => renderPlayerHudButton(key, ctx)).filter(Boolean);
  if (nodes.length === 0) return null;

  return <div className="player-hud__actions" data-tv-nav-zone="player-bottom-actions">{nodes}</div>;
}
