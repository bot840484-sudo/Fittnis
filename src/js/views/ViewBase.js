/**
 * Base view class - all views extend this
 */
class ViewBase {
  constructor(name, element) {
    this.name = name;
    this.el = element;
    this.initialized = false;
    this._subscriptions = [];
  }

  // Called once when view is first shown
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    await this.loadData();
  }

  // Override in subclasses
  async loadData() {}

  // Bind DOM events
  bindEvents() {}

  // Subscribe to store changes
  watch(key, callback) {
    const unsub = Store.subscribe(key, callback);
    this._subscriptions.push(unsub);
    return unsub;
  },

  // Show view
  show() {
    this.el.classList.add('active');
    this.onShow();
  }

  // Hide view
  hide() {
    this.el.classList.remove('active');
    this.onHide();
  }

  // Lifecycle hooks
  onShow() {}
  onHide() {}

  // Cleanup
  destroy() {
    this._subscriptions.forEach(unsub => unsub());
    this._subscriptions = [];
  },

  // Helpers
  $(selector) { return this.el.querySelector(selector); }
  $$(selector) { return this.el.querySelectorAll(selector); }
  t(key, params) { return I18n.t(key, params); }
  setLoading(key, loading) { Store.setLoading(key, loading); }
  setError(key, error) { Store.setError(key, error); }
  clearError(key) { Store.clearError(key); }
}

window.ViewBase = ViewBase;
export default ViewBase;