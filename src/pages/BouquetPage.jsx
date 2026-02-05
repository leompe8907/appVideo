/**
 * Página de Bouquets.
 * Se muestra después de seleccionar un perfil o una tarjeta (licencia).
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { Bouquet } from '../components/bouquet/Bouquet';
import panaccessService from '../services/panaccessService';
import '../styles/pages/_bouquet.scss';

export function BouquetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, appName, getImage } = useBrand();

  const handleBack = () => {
    panaccessService.logout();
    localStorage.removeItem('sessionId');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    navigate('/login');
  };

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div
      className="bouquet-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="bouquet-overlay" />
      <div className="bouquet-container">
        <header className="bouquet-header">
          {currentBrand?.assets?.logo && (
            <img
              src={currentBrand.assets.logo}
              alt={appName}
              className="bouquet-logo"
            />
          )}
          <h1 className="bouquet-title">{t('bouquet.title')}</h1>
        </header>
        <div className="bouquet-content">
          <Bouquet />
        </div>
        <footer className="bouquet-footer">
          <FocusableButton
            className="bouquet-back-button"
            onClick={handleBack}
            onEnterPress={handleBack}
            focusKey="bouquet-back"
          >
            {t('common.backLogout')}
          </FocusableButton>
        </footer>
      </div>
    </div>
  );
}

export default BouquetPage;
