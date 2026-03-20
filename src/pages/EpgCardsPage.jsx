import { useBrand } from '../contexts/BrandContext';
import EpgCards from '../components/epg/EpgCards';
import '../styles/pages/_epg.scss';

export function EpgCardsPage() {
  const { currentBrand, getImage } = useBrand();
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div
      className="epg-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="epg-page-overlay" />
      <div className="epg-page-content">
        <EpgCards />
      </div>
    </div>
  );
}

export default EpgCardsPage;

