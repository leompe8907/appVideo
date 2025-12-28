/**
 * Página de Perfiles de Usuario
 */

import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

export function ProfilePage() {
  const navigate = useNavigate();
  const { appName } = useBrand();
  const { isTV, deviceType } = useDevice();

  console.log(`🖥️ [PROFILE] Modo: ${isTV ? 'TV' : 'PC'}`);

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Perfiles de Usuario</h1>
        <span className="device-badge">
          {isTV ? '📺 TV' : '💻 PC'} ({deviceType})
        </span>
      </header>

      <div className="profile-content">
        <p>Selecciona o crea un perfil de usuario</p>
        <p className="info-text">Próximamente: Gestión de perfiles...</p>
      </div>

      <footer className="profile-footer">
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

export default ProfilePage;

