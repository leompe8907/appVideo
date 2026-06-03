import { useLayoutEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { HomeShellContent } from '../components/ads/HomeShellContent';
import { usePlayer } from '../contexts/PlayerContext';
import PlayerHud from '../components/player/PlayerHud';
import ConfirmModal from '../components/ConfirmModal';
import ParentalGateHost from '../components/parental/ParentalGateHost';
import EpgReminderHost from '../components/epg/EpgReminderHost';
import InactivityHost from '../components/inactivity/InactivityHost';
import { useTranslation } from 'react-i18next';
import '../styles/pages/_home-shell.scss';
import { useOsmsPolling } from '../hooks/useOsmsPolling';
import { HomeInputDispatcher } from '../components/home/HomeInputDispatcher';
import {
  getRestoredMainFocusTargetIfValid,
  rememberMainShellFocus,
} from '../utils/homeShellLastContentFocus';
import {
  focusElementSafe,
  getVisibleFocusablesInContainer,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';

export function HomePlaceholderPage({ title, description }) {
  return (
    <section className="home-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { containerRef, state: playerState, licenseInUsePrompt, confirmLicenseInUse, close } = usePlayer();
  const isPlayerActive = Boolean(playerState?.url);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // OSMS: refresco periódico y al volver a foreground (solo si la feature está habilitada por brand)
  useOsmsPolling({ intervalMs: 2 * 60 * 1000, days: 30 });
  const debugEnabled = (() => {
    if (import.meta.env.DEV) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      const v = String(params.get('playerDebug') || '').toLowerCase();
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  })();

  // Al abrir el player: recordar el foco del shell (p. ej. tarjeta de canal) y moverlo al contenedor de video.
  useLayoutEffect(() => {
    if (!isPlayerActive) return;
    const player = containerRef.current;
    if (!player) return;
    const active = document.activeElement;
    const shell = document.querySelector('.home-shell-ui');
    if (active instanceof HTMLElement && shell?.contains(active)) {
      rememberMainShellFocus(active);
    }
    if (!active || !player.contains(active)) {
      if (active instanceof HTMLElement && shell?.contains(active)) {
        player.focus({ preventScroll: true });
      }
    }
  }, [isPlayerActive, containerRef]);

  // Al cerrar el player (botón volver / BACK): restaurar el último foco del contenido principal.
  useLayoutEffect(() => {
    if (isPlayerActive) return undefined;
    let cancelled = false;

    const tryRestore = () => {
      if (cancelled) return;
      const main = document.querySelector('main.home-content[data-home-scope="content"]');
      if (!(main instanceof HTMLElement)) return;

      const restored = getRestoredMainFocusTargetIfValid(main);
      if (restored && focusElementSafe(restored)) {
        const bouquetScroll = restored.closest('.bouquet-inicio-scroll');
        if (bouquetScroll instanceof HTMLElement) {
          scrollElementIntoVisibleScrollAncestors(restored, bouquetScroll);
        } else {
          const stack = main.querySelector('.home-content-stack');
          if (stack instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(restored, stack);
          }
        }
        return;
      }

      const list = getVisibleFocusablesInContainer(main);
      if (list[0]) focusElementSafe(list[0]);
    };

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(tryRestore);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isPlayerActive]);

  useLayoutEffect(() => {
    if (!debugEnabled) return;
    console.log('[HomePage]', 'isPlayerActive', isPlayerActive, {
      type: playerState?.type,
      id: playerState?.id,
      url: playerState?.url,
      isPlaying: playerState?.isPlaying,
      isLoading: playerState?.isLoading,
      isSeeking: playerState?.isSeeking,
      error: playerState?.error,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerActive, playerState?.url, playerState?.isPlaying, playerState?.isLoading, playerState?.isSeeking]);

  if (pathname === '/home') {
    return <Navigate to="/home/inicio" replace />;
  }

  return (
    <div className={`home-shell${isPlayerActive ? ' home-shell--player-active' : ''}`}>
      <HomeInputDispatcher isPlayerActive={isPlayerActive} />
      <ConfirmModal
        open={!!licenseInUsePrompt}
        title={t('smartcard.licenseInUseConfirm')}
        message=""
        confirmText={t('smartcard.licenseInUseYes')}
        cancelText={t('smartcard.licenseInUseNo')}
        onConfirm={() => confirmLicenseInUse(true)}
        onCancel={() => {
          confirmLicenseInUse(false);
          close();
        }}
      />
      <ParentalGateHost />
      <EpgReminderHost />
      <InactivityHost />
      <div className={`home-global-player${isPlayerActive ? ' home-global-player--active' : ''}`}>
        {/*
          El motor solo debe montar el <video> en un nodo que React no reordene.
          Si ref + video comparten el mismo div que Spinner/PlayerHud, el reconciliador
          puede quitar el video al actualizar hijos → pantalla negra con HUD visible.
        */}
        <div
          className="home-global-player__media"
          ref={containerRef}
          tabIndex={isPlayerActive ? -1 : undefined}
          role={isPlayerActive ? 'application' : undefined}
          aria-label={isPlayerActive ? t('player.player', { defaultValue: 'Reproductor' }) : undefined}
        />
        {isPlayerActive &&
          !playerState?.isPlaying &&
          (playerState?.isLoading || playerState?.isSeeking) && (
          <div className="home-global-player-loading">
            <div className="home-global-player-loading-spinner" />
          </div>
        )}
        {isPlayerActive && <PlayerHud isPlaybackMaximized />}
      </div>

      <div
        className={[
          'home-shell-ui',
          isPlayerActive ? 'home-shell-ui--hidden' : '',
          sidebarExpanded ? '' : 'home-shell-ui--sidebar-collapsed',
        ].filter(Boolean).join(' ')}
      >
        {!isPlayerActive && sidebarExpanded && <div className="home-shell-dim" aria-hidden="true" />}
        <Sidebar expanded={sidebarExpanded} onExpandedChange={setSidebarExpanded} />
        <main className="home-content" data-home-scope="content">
          <HomeShellContent />
        </main>
      </div>
    </div>
  );
}

export default HomePage;

