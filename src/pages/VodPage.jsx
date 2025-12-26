/**
 * Página de Video On Demand
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

export function VodPage() {
  const { ref, focusKey } = useFocusable({
    focusable: false,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="vod-page">
        <BackButton />
        <h1>Video On Demand</h1>
        <p>Próximamente: Catálogo de contenido VOD...</p>
      </div>
    </FocusContext.Provider>
  );
}

export default VodPage;
