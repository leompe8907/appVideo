import { PLAYER_HUD_BUTTON_KEYS } from '../../config/playerHudLayout.js';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import { PLAYER_FOCUS_IDS } from '../../hooks/usePlayerHudTvNavigation';

/**
 * @typedef {object} PlayerHudButtonContext
 * @property {Function} t
 * @property {Function} navigate
 * @property {Function} close
 * @property {Function} closePlayerOverlay
 * @property {Function} openPlayerOverlay
 * @property {boolean} isLiveService
 * @property {boolean} isTV
 * @property {boolean} isFullscreen
 * @property {Function} toggleFullscreen
 * @property {boolean} currentChannelBlocked
 * @property {Function} toggleCurrentChannelBlock
 * @property {boolean} hasTrackOptions
 * @property {object} state
 * @property {Function} handlePlayPause
 * @property {boolean} isLiveWithWindow
 * @property {Function} skipLiveBy
 * @property {Function} backward
 * @property {Function} forward
 * @property {Function} goLive
 * @property {number|undefined} hudTvTabIndex
 * @property {string} clockText
 * @property {boolean} [epgEnabledForBrand] - bandera EPG.enabled (brands.js); default true.
 */

/**
 * @param {string} buttonKey
 * @param {PlayerHudButtonContext} ctx
 * @returns {import('react').ReactNode}
 */
export function renderPlayerHudButton(buttonKey, ctx) {
  const tab = ctx.hudTvTabIndex;
  const navProps = { 'data-tv-nav': 'player-hud', tabIndex: tab };

  switch (buttonKey) {
    case PLAYER_HUD_BUTTON_KEYS.BACK:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.BACK}
          {...navProps}
          onClick={() => ctx.close()}
          aria-label={ctx.t('common.back', { defaultValue: 'Volver' })}
        >
          <AppIcon name="back" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.EPG:
      if (ctx.epgEnabledForBrand === false) return null;
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.EPG}
          {...navProps}
          onClick={() => {
            ctx.closePlayerOverlay();
            ctx.close();
            ctx.navigate('/home/epg');
          }}
          aria-label={ctx.t('epg.title', { defaultValue: 'EPG' })}
          title={ctx.t('epg.title', { defaultValue: 'EPG' })}
        >
          <AppIcon name="list" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.LOCK:
      if (!ctx.isLiveService) return null;
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.LOCK}
          {...navProps}
          onClick={ctx.toggleCurrentChannelBlock}
          aria-label={
            ctx.currentChannelBlocked
              ? ctx.t('parental.unblock', { defaultValue: 'Desbloquear canal' })
              : ctx.t('parental.block', { defaultValue: 'Bloquear canal' })
          }
          title={
            ctx.currentChannelBlocked
              ? ctx.t('parental.unblock', { defaultValue: 'Desbloquear canal' })
              : ctx.t('parental.block', { defaultValue: 'Bloquear canal' })
          }
        >
          <AppIcon name={ctx.currentChannelBlocked ? 'lockOpen' : 'lock'} size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.CHANNELS:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.CHANNELS}
          {...navProps}
          onClick={() => ctx.openPlayerOverlay('channels')}
          aria-label={ctx.t('player.channels', { defaultValue: 'Canales' })}
        >
          <AppIcon name="menu" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.INFO:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.INFO}
          {...navProps}
          onClick={() => ctx.openPlayerOverlay('info')}
          aria-label={ctx.t('player.info', { defaultValue: 'Información' })}
        >
          <AppIcon name="info" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.TRACKS:
      if (!ctx.hasTrackOptions) return null;
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.TRACKS}
          {...navProps}
          onClick={() => ctx.openPlayerOverlay('tracks')}
          aria-label={ctx.t('player.tracks', { defaultValue: 'Audio/Subtítulos' })}
        >
          <AppIcon name="subtitles" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.REWIND:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.REWIND}
          {...navProps}
          onClick={() => (ctx.isLiveWithWindow ? ctx.skipLiveBy(-10) : ctx.backward(10))}
          aria-label={ctx.t('player.rewind10', { defaultValue: 'Retroceder 10s' })}
        >
          <AppIcon name="rewind" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.PLAY:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn player-hud__iconbtn--primary"
          id={PLAYER_FOCUS_IDS.PLAY}
          {...navProps}
          onClick={ctx.handlePlayPause}
          aria-label={
            ctx.state?.isPlaying
              ? ctx.t('player.pause', { defaultValue: 'Pausar' })
              : ctx.t('player.play', { defaultValue: 'Reproducir' })
          }
        >
          <AppIcon name={ctx.state?.isPlaying ? 'pause' : 'play'} size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.FORWARD:
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          id={PLAYER_FOCUS_IDS.FORWARD}
          {...navProps}
          onClick={() => (ctx.isLiveWithWindow ? ctx.skipLiveBy(10) : ctx.forward(10))}
          aria-label={ctx.t('player.forward10', { defaultValue: 'Adelantar 10s' })}
        >
          <AppIcon name="forward" size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.FULLSCREEN:
      if (ctx.isTV) return null;
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__iconbtn"
          onClick={ctx.toggleFullscreen}
          aria-label={
            ctx.isFullscreen
              ? ctx.t('player.exitFullscreen', { defaultValue: 'Salir de pantalla completa' })
              : ctx.t('player.fullscreen', { defaultValue: 'Pantalla completa' })
          }
          title={
            ctx.isFullscreen
              ? ctx.t('player.exitFullscreen', { defaultValue: 'Salir de pantalla completa' })
              : ctx.t('player.fullscreen', { defaultValue: 'Pantalla completa' })
          }
        >
          <AppIcon name={ctx.isFullscreen ? 'fullscreenExit' : 'fullscreen'} size="1em" />
        </FocusableButton>
      );

    case PLAYER_HUD_BUTTON_KEYS.CLOCK:
      return (
        <div key={buttonKey} className="player-hud__clock" aria-label={ctx.t('common.time', { defaultValue: 'Hora' })}>
          {ctx.clockText}
        </div>
      );

    case PLAYER_HUD_BUTTON_KEYS.GO_LIVE:
      if (!ctx.isLiveWithWindow) return null;
      return (
        <FocusableButton
          key={buttonKey}
          type="button"
          className="player-hud__pillbtn"
          id={PLAYER_FOCUS_IDS.GO_LIVE}
          {...navProps}
          onClick={ctx.goLive}
        >
          {ctx.t('player.goLive', { defaultValue: 'En vivo' })}
        </FocusableButton>
      );

    default:
      return null;
  }
}
