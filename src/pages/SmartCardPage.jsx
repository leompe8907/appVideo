/**
 * Página de SmartCard
 */

import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

export function SmartCardPage() {
  const navigate = useNavigate();
  const { appName } = useBrand();
  const { isTV, deviceType } = useDevice();

  console.log(`🖥️ [SMARTCARD] Modo: ${isTV ? 'TV' : 'PC'}`);

  return (
    <div className="smartcard-page">
      <header className="smartcard-header">
        <h1>SmartCard</h1>
        <span className="device-badge">
          {isTV ? '📺 TV' : '💻 PC'} ({deviceType})
        </span>
      </header>

      <div className="smartcard-content">
        <p>Gestión de SmartCard</p>
        <p className="info-text">Próximamente: Funcionalidad de SmartCard...</p>
      </div>

      <footer className="smartcard-footer">
        <button
          className="back-button"
          onClick={() => navigate('/home')}
        >
          ← Volver al Inicio
        </button>
      </footer>
    </div>
  );
}

export default SmartCardPage;

