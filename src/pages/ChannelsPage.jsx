/**
 * Página de Canales en Vivo
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

export function ChannelsPage() {
  const { ref, focusKey } = useFocusable({
    focusable: false,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="channels-page">
        <BackButton />
        <h1>Canales en Vivo</h1>
        <p>Próximamente: Listado de canales con streaming...</p>
      </div>
    </FocusContext.Provider>
  );
}

export default ChannelsPage;
