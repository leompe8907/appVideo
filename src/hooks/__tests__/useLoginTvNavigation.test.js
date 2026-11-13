import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { focusManager } from '../../navigation/FocusManager';
import { navigationRouter } from '../../navigation/NavigationRouter';
import { useLoginTvNavigation } from '../useLoginTvNavigation';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const formRef = { current: null };
function Login() {
  useLoginTvNavigation({ isTV: true, loginFormRef: formRef, exitHint: 'Pulsa Atrás otra vez' });
  return createElement('form', { ref: formRef });
}

const press = (init) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

/** Certificación Samsung: Return en la pantalla inicial (login) debe cerrar la app. */
describe('useLoginTvNavigation – Atrás en la pantalla raíz', () => {
  let container;
  let root;
  let exit;

  beforeEach(() => {
    focusManager.clear();
    exit = vi.fn();
    window.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    navigationRouter.start();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(Login)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    navigationRouter.stop();
    document.querySelector('.exit-hint')?.remove();
    delete window.tizen;
  });

  it('el primer Return avisa y el segundo cierra la app', () => {
    press({ keyCode: 10009 });
    expect(exit).not.toHaveBeenCalled();
    expect(document.querySelector('.exit-hint')?.textContent).toBe('Pulsa Atrás otra vez');
    press({ keyCode: 10009 });
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('Backspace no sale (borra texto en los campos)', () => {
    press({ key: 'Backspace', keyCode: 8 });
    press({ key: 'Backspace', keyCode: 8 });
    expect(exit).not.toHaveBeenCalled();
  });

  it('con un modal abierto, Return lo cierra en vez de salir', () => {
    const onBack = vi.fn();
    focusManager.push('login-modal', { scopeEl: document.body, onBack });
    press({ keyCode: 10009 });
    press({ keyCode: 10009 });
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(exit).not.toHaveBeenCalled();
  });
});
