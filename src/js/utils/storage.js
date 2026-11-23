/**
 * Storage utility - wraps localStorage/sessionStorage with JSON handling
 * and fallback for private browsing / quota exceeded
 */
const Storage = {
  // Check if storage is available
  _available(type = 'localStorage') {
    try {
      const storage = window[type];
      const test = '__storage_test__';
      storage.setItem(test, test);
      storage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  _localAvailable: null,
  _sessionAvailable: null,

  get localAvailable() {
    if (this._localAvailable === null) this._localAvailable = this._available('localStorage');
    return this._localAvailable;
  },

  get sessionAvailable() {
    if (this._sessionAvailable === null) this._sessionAvailable = this._available('sessionStorage');
    return this._sessionAvailable;
  },

  // In-memory fallback
  _memoryStore: new Map(),

  _getStore(type) {
    if (type === 'local') return this.localAvailable ? localStorage : this._memoryStore;
    return this.sessionAvailable ? sessionStorage : this._memoryStore;
  },

  // Get item with JSON parsing
  get(key, type = 'local') {
    try {
      const store = this._getStore(type);
      const val = store.getItem(key);
      if (val === null || val === undefined) return null;
      return JSON.parse(val);
    } catch (e) {
      console.warn(`Storage get error for ${key}:`, e);
      return null;
    }
  },

  // Set item with JSON stringify
  set(key, value, type = 'local') {
    try {
      const store = this._getStore(type);
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`Storage set error for ${key}:`, e);
      return false;
    }
  },

  // Remove item
  remove(key, type = 'local') {
    try {
      const store = this._getStore(type);
      store.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`Storage remove error for ${key}:`, e);
      return false;
    }
  },

  // Clear all app data
  clearAppData() {
    const prefix = 'fittnis_';
    try {
      if (this.localAvailable) {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(prefix)) localStorage.removeItem(k);
        });
      }
      if (this.sessionAvailable) {
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith(prefix)) sessionStorage.removeItem(k);
        });
      }
      this._memoryStore.clear();
      return true;
    } catch (e) {
      console.warn('Clear app data error:', e);
      return false;
    }
  },

  // Keys with prefix
  keys(type = 'local') {
    const prefix = 'fittnis_';
    const store = this._getStore(type);
    const result = [];
    try {
      if (store instanceof Map) {
        store.forEach((_, k) => { if (k.startsWith(prefix)) result.push(k); });
      } else {
        Object.keys(store).forEach(k => { if (k.startsWith(prefix)) result.push(k); });
      }
    } catch (e) {
      console.warn('Storage keys error:', e);
    }
    return result;
  }
};

// Export for modules
window.Storage = Storage;
export default Storage;