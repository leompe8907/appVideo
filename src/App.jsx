/**
 * Componente App principal
 * Envuelve la app con BrandProvider para compartir configuración
 */

import { BrandProvider } from './contexts/BrandContext';
import { AppRouter } from './routes/AppRouter';

function App() {
  return (
    <BrandProvider>
      <AppRouter />
    </BrandProvider>
  );
}

export default App;
