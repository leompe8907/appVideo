import { useLayoutEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { HomeShellContent } from '../components/ads/HomeShellContent';
import { usePlayer } from '../contexts/PlayerContext';
import PlayerHud from '../components/player/PlayerHud';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import '../styles/pages/_home-shell.scss';

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

  // Evita el aviso "Blocked aria-hidden… descendant retained focus": no marcamos el shell
  // con aria-hidden mientras el foco sigue en una tarjeta; movemos el foco al player.
  useLayoutEffect(() => {
    if (!isPlayerActive) return;
    const player = containerRef.current;
    if (!player) return;
    const active = document.activeElement;
    if (!active || !player.contains(active)) {
      const shell = document.querySelector('.home-shell-ui');
      if (shell?.contains(active)) {
        player.focus({ preventScroll: true });
      }
    }
  }, [isPlayerActive, containerRef]);

  if (pathname === '/home') {
    return <Navigate to="/home/inicio" replace />;
  }

  return (
    <div className={`home-shell${isPlayerActive ? ' home-shell--player-active' : ''}`}>
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
          aria-label={isPlayerActive ? 'Reproductor' : undefined}
        />
        {isPlayerActive && (playerState?.isLoading || playerState?.isSeeking) && (
          <div className="home-global-player-loading">
            <div className="home-global-player-loading-spinner" />
          </div>
        )}
        {isPlayerActive && !(playerState?.isLoading || playerState?.isSeeking) && <PlayerHud />}
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
        <main className="home-content">
          <HomeShellContent />
        </main>
      </div>
    </div>
  );
}

export default HomePage;

