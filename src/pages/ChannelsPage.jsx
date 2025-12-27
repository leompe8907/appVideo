/**
 * Página de Canales en Vivo
 */

import { useNavigate } from 'react-router-dom';

function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      className="back-button"
      onClick={() => navigate('/home')}
    >
      ← Volver
    </button>
  );
}

export function ChannelsPage() {
  return (
    <div className="channels-page">
      <BackButton />
      <h1>Canales en Vivo</h1>
      <p>Próximamente: Listado de canales con streaming...</p>
    </div>
  );
}

export default ChannelsPage;
