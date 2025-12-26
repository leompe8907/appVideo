/**
 * Página de Guía EPG
 */

import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

function BackButton() {
  const navigate = useNavigate();
  const { ref, focused } = useFocusable({
    onEnterPress: () => navigate('/home'),
  });

  return (
    <button
      ref={ref}
      className={`back-button ${focused ? 'focused' : ''}`}
      onClick={() => navigate('/home')}
    >
      ← Volver
    </button>
  );
}

export function EpgPage() {
  const { ref, focusKey } = useFocusable({
    focusable: false,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="epg-page">
        <BackButton />
        <h1>Guía de Programación (EPG)</h1>
        <p>Próximamente: Guía completa de programación...</p>
      </div>
    </FocusContext.Provider>
  );
}

export default EpgPage;
