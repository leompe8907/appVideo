import { useNavigate } from 'react-router-dom';
import '../../styles/license/LicenseEmptyState.scss';

export function LicenseEmptyState({ message = 'No se encontraron licencias.' }) {
  const navigate = useNavigate();

  return (
    <div className="license-empty-state">
      <p className="no-licenses">{message}</p>
      <button className="back-button" onClick={() => navigate('/home')}>
        ← Volver al Inicio
      </button>
    </div>
  );
}

export default LicenseEmptyState;

