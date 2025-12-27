/**
 * Página de Guía EPG
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

export function EpgPage() {
  return (
    <div className="epg-page">
      <BackButton />
      <h1>Guía de Programación (EPG)</h1>
      <p>Próximamente: Guía completa de programación...</p>
    </div>
  );
}

export default EpgPage;
