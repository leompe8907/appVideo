import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useOsmsStore } from '../store/osmsStore';
import '../styles/pages/_osms.scss';

function formatDate(date, locale) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString(locale || undefined);
  } catch {
    return '';
  }
}

function previewText(message, maxLen = 80) {
  const txt = typeof message === 'string' ? message.trim() : String(message ?? '');
  if (!txt) return '';
  return txt.length > maxLen ? `${txt.slice(0, maxLen)}…` : txt;
}

export function OsmsPage() {
  const { t, i18n } = useTranslation();
  const { currentBrand } = useBrand();
  const enabled = Boolean(currentBrand?.features?.osms);

  const status = useOsmsStore((s) => s.status);
  const items = useOsmsStore((s) => s.items);
  const error = useOsmsStore((s) => s.error);
  const refreshOsms = useOsmsStore((s) => s.refreshOsms);
  const markAsSeen = useOsmsStore((s) => s.markAsSeen);
  const hasNew = useOsmsStore((s) => s.hasNew);

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    refreshOsms({ force: false });
  }, [enabled, refreshOsms]);

  useEffect(() => {
    if (!enabled) return;
    if ((items?.length ?? 0) > 0) {
      // al entrar a la página, marcar como visto (equivalente a abrir la lista en legacy)
      markAsSeen();
    }
  }, [enabled, items?.length, markAsSeen]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (items || []).find((m) => String(m.id) === String(selectedId)) || null;
  }, [items, selectedId]);

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
            className="osms-page__btn"
            onClick={() => refreshOsms({ force: true })}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? t('osms.refreshing') : t('osms.refresh')}
          </button>
          <button
            type="button"
            className="osms-page__btn osms-page__btn--ghost"
            onClick={() => markAsSeen()}
          >
            {t('osms.markSeen')}
          </button>
        </div>
      </header>

      {showError && <div className="osms-page__error">{error}</div>}

      {isEmpty && <div className="osms-page__empty">{t('osms.empty')}</div>}

      <div className="osms-page__layout">
        <div className="osms-page__list" role="list">
          {(items || []).map((m) => {
            const active = selectedId != null && String(m.id) === String(selectedId);
            return (
              <button
                key={String(m.id)}
                type="button"
                className={`osms-item${active ? ' is-active' : ''}`}
                onClick={() => setSelectedId(m.id)}
                role="listitem"
              >
                <div className="osms-item__date">{formatDate(m.time, i18n.language)}</div>
                <div className="osms-item__preview">
                  {previewText(m.message) || t('osms.noMessage')}
                </div>
              </button>
            );
          })}
        </div>

        <div className="osms-page__detail" aria-label={t('osms.detail')}>
          {!selected && (items?.length ?? 0) > 0 && (
            <div className="osms-page__detail-empty">{t('osms.selectOne')}</div>
          )}
          {selected && (
            <div className="osms-detail">
              <div className="osms-detail__meta">
                <div className="osms-detail__label">{t('osms.date')}</div>
                <div className="osms-detail__value">{formatDate(selected.time, i18n.language)}</div>
              </div>
              <div className="osms-detail__meta">
                <div className="osms-detail__label">{t('osms.message')}</div>
                <div className="osms-detail__value osms-detail__message">
                  {selected.message || t('osms.noMessage')}
                </div>
              </div>
              <div className="osms-detail__actions">
                <button type="button" className="osms-page__btn osms-page__btn--ghost" onClick={() => setSelectedId(null)}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default OsmsPage;

