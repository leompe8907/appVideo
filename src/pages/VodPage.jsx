/**
 * Página de Video On Demand
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

export function VodPage() {
  return (
    <div className="vod-page">
      <BackButton />
      <h1>Video On Demand</h1>
      <p>Próximamente: Catálogo de contenido VOD...</p>
    </div>
  );
}

export default VodPage;
