import { describe, it, expect, beforeEach } from 'vitest';
import {
  isVisibleFocusable,
  findNextFocusable,
  moveFocus,
} from '../spatialNavigation';

/** jsdom no calcula layout real: cada test define el rect que le conviene. */
function mockRect(el, { top, left, width, height }) {
  el.getBoundingClientRect = () => ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  });
}

function makeButton(id, rect) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.tabIndex = 0;
  document.body.appendChild(btn);
  mockRect(btn, rect);
  return btn;
}

describe('isVisibleFocusable', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('rechaza elementos disabled', () => {
    const btn = makeButton('a', { top: 0, left: 0, width: 100, height: 40 });
    btn.disabled = true;
    expect(isVisibleFocusable(btn)).toBe(false);
  });

  it('rechaza elementos aria-hidden', () => {
    const btn = makeButton('a', { top: 0, left: 0, width: 100, height: 40 });
    btn.setAttribute('aria-hidden', 'true');
    expect(isVisibleFocusable(btn)).toBe(false);
  });

  it('rechaza elementos dentro de un contenedor data-tv-nav-blocked', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-tv-nav-blocked', 'true');
    document.body.appendChild(wrapper);
    const btn = document.createElement('button');
    wrapper.appendChild(btn);
    mockRect(btn, { top: 0, left: 0, width: 100, height: 40 });
    expect(isVisibleFocusable(btn)).toBe(false);
  });

  it('rechaza elementos con rect casi nulo (colapsados)', () => {
    const btn = makeButton('a', { top: 0, left: 0, width: 1, height: 1 });
    expect(isVisibleFocusable(btn)).toBe(false);
  });

  it('acepta un botón visible con tamaño real', () => {
    const btn = makeButton('a', { top: 0, left: 0, width: 100, height: 40 });
    expect(isVisibleFocusable(btn)).toBe(true);
  });
});

describe('findNextFocusable / moveFocus — geometría direccional', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('DOWN elige el elemento más cercano debajo, no uno más lejos aunque mejor alineado', () => {
    // Grilla 2x2: from = arriba-izquierda. below-left está justo debajo (más cerca);
    // below-right está debajo pero más a la derecha (peor, pero igual "debajo").
    const from = makeButton('from', { top: 0, left: 0, width: 100, height: 40 });
    const belowLeft = makeButton('below-left', { top: 60, left: 0, width: 100, height: 40 });
    const belowRight = makeButton('below-right', { top: 60, left: 300, width: 100, height: 40 });
    from.focus();

    const next = findNextFocusable(from, 'down');
    expect(next).toBe(belowLeft);
    void belowRight;
  });

  it('RIGHT elige el vecino inmediato a la derecha', () => {
    const from = makeButton('from', { top: 0, left: 0, width: 100, height: 40 });
    const right = makeButton('right', { top: 0, left: 120, width: 100, height: 40 });
    from.focus();

    const next = findNextFocusable(from, 'right');
    expect(next).toBe(right);
  });

  it(
    'un candidato levemente superpuesto (overlap por margen negativo de diseño) queda ' +
      'excluido como candidato DOWN — regresión del bug de "olvidé contraseña" inalcanzable en Login',
    () => {
      // Reproduce el caso real: un elemento "de abajo" cuyo top queda por encima
      // del bottom del elemento activo (overlap), como pasaba con el margen
      // negativo de `.login-forgot-row`. El motor debe descartarlo como
      // candidato para DOWN (primary < -1) en vez de "encontrarlo" igual.
      const from = makeButton('password', { top: 0, left: 0, width: 100, height: 40 });
      const overlapping = makeButton('overlapping-below', {
        top: 38, // 2px de solape con el bottom de `from` (40) — más que el margen de tolerancia (-1)
        left: 0,
        width: 100,
        height: 20,
      });
      const properlyBelow = makeButton('properly-below', { top: 60, left: 0, width: 100, height: 40 });
      from.focus();

      const next = findNextFocusable(from, 'down');
      expect(next).not.toBe(overlapping);
      expect(next).toBe(properlyBelow);
    },
  );

  it('moveFocus mueve el foco real del documento y devuelve true al encontrar candidato', () => {
    const from = makeButton('from', { top: 0, left: 0, width: 100, height: 40 });
    const right = makeButton('right', { top: 0, left: 120, width: 100, height: 40 });
    from.focus();

    const moved = moveFocus('right', document.body);

    expect(moved).toBe(true);
    expect(document.activeElement).toBe(right);
  });

  it('moveFocus devuelve false y no mueve el foco si no hay candidato en esa dirección', () => {
    const from = makeButton('from', { top: 0, left: 0, width: 100, height: 40 });
    from.focus();

    const moved = moveFocus('down', document.body);

    expect(moved).toBe(false);
    expect(document.activeElement).toBe(from);
  });

  it('moveFocus respeta el scope: no encuentra candidatos fuera del root dado', () => {
    const scope = document.createElement('div');
    document.body.appendChild(scope);

    const from = document.createElement('button');
    from.tabIndex = 0;
    scope.appendChild(from);
    mockRect(from, { top: 0, left: 0, width: 100, height: 40 });

    // Candidato "correcto" geométricamente pero FUERA del scope.
    const outside = makeButton('outside', { top: 60, left: 0, width: 100, height: 40 });
    document.body.appendChild(outside); // ya está fuera de `scope`
    void outside;

    from.focus();
    const moved = moveFocus('down', scope);

    expect(moved).toBe(false);
    expect(document.activeElement).toBe(from);
  });
});
