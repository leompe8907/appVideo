/**
 * Página de Bouquets.
 * Solo muestra el muro de bouquets con canales (sin header/footer; resto configurable en Home).
 */

import { useBrand } from '../contexts/BrandContext';
import BouquetWall from '../components/bouquet/BouquetWall';
import '../styles/pages/_bouquet.scss';

export function BouquetPage() {
  const { currentBrand, getImage } = useBrand();
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div
      className="bouquet-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="bouquet-overlay" />
      <div className="bouquet-container">
        <div className="bouquet-content">
          <BouquetWall />
        </div>
      </div>
    </div>
  );
}

export default BouquetPage;
