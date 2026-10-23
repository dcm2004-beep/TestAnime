// Minimal pub/sub. A throwing listener never stops other listeners or the emitter.
export function createBus() {
  const listeners = new Map();
  const bus = {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => bus.off(event, fn);
    },
    once(event, fn) {
      const off = bus.on(event, (payload) => { off(); fn(payload); });
      return off;
    },
    off(event, fn) {
      const set = listeners.get(event);
      if (set) { set.delete(fn); if (!set.size) listeners.delete(event); }
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(payload); } catch (err) { console.error(`[bus] listener for "${event}" threw`, err); }
      }
    },
    clear() { listeners.clear(); },
  };
  return bus;
}
