import { describe, it, expect } from 'vitest';
import { WebEngine } from '../WebEngine.js';

/**
 * Regresión: al reemplazar el plugin vendorizado por `videojsHlsSourceHandler.js`
 * quedó una referencia suelta a `plugins: { streamrootHls: {...} } }` en la
 * construcción del player (`buildStreamrootHlsPluginOptions()`) — esa opción le
 * dice a video.js que busque un plugin registrado con ese nombre y lo llame de
 * inmediato; al ya no existir ese plugin, video.js tira
 * `Error: plugin "streamrootHls" does not exist` apenas se intenta reproducir
 * cualquier canal/VOD en PC. Este test reproduce el flujo real
 * (`WebEngine.init()` + `load()` con una URL de canal real) para que este caso
 * puntual no vuelva a pasar inadvertido.
 */
describe('WebEngine', () => {
  it('init() + load() no lanzan (regresión: plugin "streamrootHls" ya no existe)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const engine = new WebEngine();

    await expect(engine.init(container)).resolves.not.toThrow();

    expect(() => {
      engine.load(
        'https://pmdw-1.in.tv.br/index.php?requestMode=m3u8&streamId=262&sessionId=abc',
        { type: 'service' },
      );
    }).not.toThrow();

    engine.destroy();
  });
});
