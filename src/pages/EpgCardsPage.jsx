import EpgCards from '../components/epg/EpgCards';
import '../styles/pages/_epg.scss';

export function EpgCardsPage() {
  return (
    <div className="epg-page">
      <div className="epg-page-overlay" />
      <div className="epg-page-content" data-home-spatial-delegate="true">
        <EpgCards />
      </div>
    </div>
  );
}

export default EpgCardsPage;

