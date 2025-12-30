import { useNavigate } from 'react-router-dom';
import '../../styles/license/LicenseErrorState.scss';

export function LicenseErrorState({ error, onRetry }) {
  const navigate = useNavigate();

  return (
    <div className="license-error-state">
      <div className="error-icon">⚠️</div>
      <p className="error-text">{error || 'Error al obtener licencias'}</p>
      <div className="error-actions">
        {onRetry && (
          <button className="retry-button" onClick={onRetry}>
            Reintentar
          </button>
        )}
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Volver al Inicio
        </button>
      </div>
    </div>
  );
}

export default LicenseErrorState;

