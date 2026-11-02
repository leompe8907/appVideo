// Sustituto para los tests: el SDK de Vega (@amazon-devices/...) solo se instala en apps/vega.
// Los tests que lo necesitan lo reemplazan con vi.mock.
export const WebCrypto = { subtle: {} };
