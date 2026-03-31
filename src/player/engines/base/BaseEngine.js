import { PLAYER_ENGINE_EVENTS } from '../contracts';

const ALL_EVENTS = Object.values(PLAYER_ENGINE_EVENTS);

export class BaseEngine {
  constructor() {
    this.events = {};
    ALL_EVENTS.forEach((name) => {
      this.events[name] = [];
    });
  }

  on(event, cb) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
  }

  off(event, cb) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((fn) => fn !== cb);
  }

  emit(event, payload) {
    if (!this.events[event]) return;
    this.events[event].forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[BaseEngine] Error en handler', event, e);
      }
    });
  }
}

export default BaseEngine;

