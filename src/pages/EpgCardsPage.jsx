import EpgCards from '../components/epg/EpgCards';
import '../styles/pages/_epg.scss';

export function EpgCardsPage() {
  // El background común lo maneja Home (.home-content)

  return (
    <div className="epg-page">
      <div className="epg-page-overlay" />
      <div className="epg-page-content">
        <EpgCards />
      </div>
    </div>
  );
}

export default EpgCardsPage;

