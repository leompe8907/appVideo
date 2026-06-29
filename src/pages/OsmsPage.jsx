import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useOsmsStore } from '../store/osmsStore';
import {
  captureInitialUnreadIds,
  formatCardDate,
  formatFullDate,
  groupOsmsByDay,
  previewText,
} from '../utils/osmsFormat';
import { useOsmsTvNav } from '../hooks/useOsmsTvNav';
import '../styles/pages/_osms.scss';

export function OsmsPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { currentBrand } = useBrand();
  const enabled = Boolean(currentBrand?.features?.osms);

  const status = useOsmsStore((s) => s.status);
  const items = useOsmsStore((s) => s.items);
  const error = useOsmsStore((s) => s.error);
  const refreshOsms = useOsmsStore((s) => s.refreshOsms);
  const markAsSeen = useOsmsStore((s) => s.markAsSeen);
  const hasNew = useOsmsStore((s) => s.hasNew);
  const unreadCount = useOsmsStore((s) => s.unreadCount);

  const [selectedId, setSelectedId] = useState(null);
  const [readIds, setReadIds] = useState(() => new Set());
  const initialUnreadRef = useRef(null);
  const openedFromNavRef = useRef(null);

  useOsmsTvNav({ itemsCount: items?.length ?? 0 });

  if (initialUnreadRef.current === null && (items?.length ?? 0) > 0) {
    initialUnreadRef.current = captureInitialUnreadIds(items, hasNew, unreadCount);
  }

  const openOsmIdFromNav = location.state?.openOsmId;

  const selected = useMemo(() => {
    if (selectedId == null) return null;
    return (items || []).find((m) => String(m.id) === String(selectedId)) || null;
  }, [items, selectedId]);

  useEffect(() => {
    if (!enabled) return;
    refreshOsms({ force: false });
  }, [enabled, refreshOsms]);

  useEffect(() => {
    if (!enabled) return;
    if ((items?.length ?? 0) > 0) {
      markAsSeen();
    }
  }, [enabled, items?.length, markAsSeen]);

  useEffect(() => {
    if (!enabled || (items?.length ?? 0) === 0) return;
    if (openOsmIdFromNav != null) {
      if (openedFromNavRef.current === String(openOsmIdFromNav)) return;
      const message = items.find((m) => String(m.id) === String(openOsmIdFromNav));
      if (!message) return;
      openedFromNavRef.current = String(openOsmIdFromNav);
      setSelectedId(message.id);
      setReadIds((prev) => new Set(prev).add(String(message.id)));
      return;
    }
    if (selectedId == null) {
      setSelectedId(items[0].id);
    }
  }, [enabled, items, openOsmIdFromNav, selectedId]);

  const groups = useMemo(() => groupOsmsByDay(items, t), [items, t]);

  const isUnread = (id) => {
    const key = String(id);
    if (readIds.has(key)) return false;
    return initialUnreadRef.current?.has(key) ?? false;
  };

  const selectMessage = (message) => {
    setSelectedId(message.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(String(message.id));
      return next;
    });
  };

  const markAllRead = () => {
    markAsSeen();
    initialUnreadRef.current = new Set();
    setReadIds(new Set((items || []).map((m) => String(m.id))));
  };

  if (!enabled) {
    return (
      <section className="osms-page" aria-label={t('osms.title')}>
        <header className="osms-page__header">
          <h2 className="osms-page__title">{t('osms.title')}</h2>
        </header>
        <div className="osms-page__empty">{t('osms.disabled')}</div>
      </section>
    );
  }

  const isEmpty = status === 'ready' && (items?.length ?? 0) === 0;
  const showError = status === 'error' && error;
  const isLoading = status === 'loading' && (items?.length ?? 0) === 0;

  return (
    <section className="osms-page" aria-label={t('osms.title')}>
      <header className="osms-page__header">
        <div className="osms-page__header-left">
          <h2 className="osms-page__title">{t('osms.title')}</h2>
          {hasNew && <span className="osms-page__pill">{t('osms.new')}</span>}
        </div>
        <div className="osms-page__actions">
          <button
            type="button"
            id="osms-btn-refresh"
            className="osms-page__btn"
            onClick={() => refreshOsms({ force: true })}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? t('osms.refreshing') : t('osms.refresh')}
          </button>
          <button
            type="button"
            id="osms-btn-seen"
            className="osms-page__btn osms-page__btn--ghost"
            onClick={markAllRead}
          >
            {t('osms.markSeen')}
          </button>
        </div>
      </header>

      {showError && <div className="osms-page__error">{error}</div>}

      {isLoading && (
        <div className="osms-page__loading" aria-live="polite">
          {t('common.loading')}
        </div>
      )}

      {isEmpty && (
        <div className="osms-page__empty osms-page__empty--illustrated">
          <div className="osms-page__empty-icon" aria-hidden="true" />
          <p className="osms-page__empty-title">{t('osms.empty')}</p>
          <p className="osms-page__empty-hint">{t('osms.emptyHint')}</p>
        </div>
      )}

      {!isEmpty && !isLoading && (
        <div className="osms-page__layout">
          <aside className="osms-page__list-panel" aria-label={t('osms.title')}>
            <div className="osms-page__list" role="list">
              {(() => {
                let globalIdx = 0;
                return groups.map((group) => (
                  <section key={group.label} className="osms-list-group" aria-label={group.label}>
                    <h3 className="osms-list-group__label">{group.label}</h3>
                    {group.items.map((m) => {
                      const unread = isUnread(m.id);
                      const active = selectedId != null && String(m.id) === String(selectedId);
                      const preview = previewText(m.message, 72) || t('osms.noMessage');
                      const dateText = formatCardDate(m.time, i18n.language);
                      const index = globalIdx++;

                      return (
                        <button
                          key={String(m.id)}
                          id={`osms-item-${index}`}
                          type="button"
                          className={`osms-list-item${active ? ' is-active' : ''}${unread ? ' osms-list-item--unread' : ''}`}
                          onClick={() => selectMessage(m)}
                          role="listitem"
                        >
                          <div className="osms-list-item__meta">
                            {unread && <span className="osms-list-item__dot" aria-hidden="true" />}
                            <time className="osms-list-item__date" dateTime={m.time?.toISOString?.()}>
                              {dateText}
                            </time>
                          </div>
                          <p className="osms-list-item__preview">{preview}</p>
                        </button>
                      );
                    })}
                  </section>
                ));
              })()}
            </div>
          </aside>

          <div className="osms-page__detail-panel" aria-label={t('osms.detail')}>
            {!selected && (
              <div className="osms-page__detail-empty">{t('osms.selectOne')}</div>
            )}
            {selected && (
              <article className="osms-detail">
                <header className="osms-detail__header">
                  <div className="osms-detail__label">{t('osms.date')}</div>
                  <time className="osms-detail__date" dateTime={selected.time?.toISOString?.()}>
                    {formatFullDate(selected.time, i18n.language)}
                  </time>
                </header>
                <div className="osms-detail__body">
                  <div className="osms-detail__label">{t('osms.message')}</div>
                  <p className="osms-detail__message">
                    {selected.message || t('osms.noMessage')}
                  </p>
                </div>
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default OsmsPage;
