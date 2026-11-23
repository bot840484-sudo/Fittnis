/**
 * Central data store - manages app state with reactivity
 */
const Store = {
  _state: {
    // User data
    profile: null,
    settings: {},

    // Workouts
    workouts: [],
    currentWorkout: null,

    // Runs (GPS)
    runs: [],
    currentRun: null,

    // Food
    foodLogs: [],
    dailyNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },

    // UI state
    currentView: 'today',
    currentDate: new Date().toISOString().split('T')[0],
    language: 'uz',

    // Timer
    timer: { running: false, elapsed: 0, intervals: [], currentInterval: 0 },

    // Map
    map: null,
    mapMarkers: [],

    // Leaderboard
    leaderboard: [],
    myRank: null,

    // Loading states
    loading: {},
    errors: {}
  },

  _listeners: new Map(),

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(callback);
    return () => this.unsubscribe(key, callback);
  },

  unsubscribe(key, callback) {
    if (this._listeners.has(key)) this._listeners.get(key).delete(callback);
  },

  _notify(key) {
    if (this._listeners.has(key)) {
      this._listeners.get(key).forEach(cb => cb(this._state[key], this._state));
    }
  },

  // Get state value
  get(key) {
    return this._state[key];
  },

  // Set state value
  set(key, value) {
    this._state[key] = value;
    this._notify(key);
  },

  // Update nested object
  update(key, partial) {
    this._state[key] = { ...this._state[key], ...partial };
    this._notify(key);
  },

  // Array helpers
  push(key, item) {
    this._state[key] = [...this._state[key], item];
    this._notify(key);
  },

  remove(key, predicate) {
    this._state[key] = this._state[key].filter(item => !predicate(item));
    this._notify(key);
  },

  find(key, predicate) {
    return this._state[key].find(predicate);
  },

  // Loading state
  setLoading(key, loading) {
    this._state.loading[key] = loading;
    this._notify('loading');
  },

  setError(key, error) {
    this._state.errors[key] = error;
    this._notify('errors');
  },

  clearError(key) {
    delete this._state.errors[key];
    this._notify('errors');
  },

  // Reset all
  reset() {
    this._state = {
      profile: null,
      settings: {},
      workouts: [],
      currentWorkout: null,
      runs: [],
      currentRun: null,
      foodLogs: [],
      dailyNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      currentView: 'today',
      currentDate: new Date().toISOString().split('T')[0],
      language: 'uz',
      timer: { running: false, elapsed: 0, intervals: [], currentInterval: 0 },
      map: null,
      mapMarkers: [],
      leaderboard: [],
      myRank: null,
      loading: {},
      errors: {}
    };
    this._listeners.forEach((_, key) => this._notify(key));
  }
};

window.Store = Store;
export default Store;