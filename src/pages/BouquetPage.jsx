/**
 * Página de Bouquets.
 * Solo muestra el muro de bouquets con canales (sin header/footer; resto configurable en Home).
 */

import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import BouquetWall from '../components/bouquet/BouquetWall';
import PlayerContainer from '../components/player/PlayerContainer';
import '../styles/pages/_bouquet.scss';

export function BouquetPage() {
  const { currentBrand, getImage } = useBrand();
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');
  const { play } = usePlayer();

  const handleChannelSelect = (channel) => {
    if (!channel) return;

    const url =
      channel.url ||
      channel.streamUrl ||
      channel.hlsUrl ||
      channel.hls ||
      null;

    if (!url) {
      // eslint-disable-next-line no-console
      console.warn('[BouquetPage] Canal sin URL de streaming', channel);
      return;
    }

    play({
      type: 'service',
      id: channel.id ?? channel.lcn ?? undefined,
      url,
      item: channel,
      autoPlay: true,
    });
  };

  return (
    <div
      className="bouquet-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="bouquet-overlay" />
      <div className="bouquet-container">
        <div className="bouquet-content">
          <BouquetWall onChannelSelect={handleChannelSelect} />
          <PlayerContainer />
        </div>
      </div>
    </div>
  );
}

export default BouquetPage;
