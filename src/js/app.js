/**
 * Main App - Router, view management, initialization
 */
const App = {
  views: {},
  currentView: null,
  routes: {
    'today': { view: 'today', auth: true },
    'log': { view: 'log', auth: true },
    'run': { view: 'run', auth: true },
    'prog': { view: 'prog', auth: true },
    'plan': { view: 'plan', auth: true },
    'food': { view: 'food', auth: true },
    'set': { view: 'settings', auth: true },
    'cal': { view: 'cal', auth: true },
    'sport': { view: 'sport', auth: true },
    'fight': { view: 'fight', auth: true },
    'status': { view: 'leaderboard', auth: true },
    'titles': { view: 'titles', auth: true },
    'map': { view: 'map', auth: true },
    'gps': { view: 'gps', auth: true },
    'auth': { view: 'auth', auth: false }
  },

  async init() {
    // Initialize i18n
    const savedLang = Storage.get('fittnis_language', 'local') || 'uz';
    I18n.init(savedLang);

    // Initialize auth
    const hasSession = Auth.init();
    Auth.onAuthChange(user => this.onAuthChange(user));

    // Initialize views
    this.initViews();

    // Register service worker
    this.registerSW();

    // Handle navigation
    this.bindNavigation();

    // Apply translations
    this.applyTranslations();

    // Check auth state
    if (hasSession) {
      await this.validateAndEnter();
    } else {
      this.showAuth();
    }
  },

  initViews() {
    // Create view instances
    this.views.auth = new AuthView();
    this.views.today = new TodayView();
    this.views.log = new LogView();
    this.views.run = new RunView();
    this.views.food = new FoodView();
    this.views.settings = new SettingsView();
    this.views.leaderboard = new LeaderboardView();

    // Placeholder views for remaining pages
    ['prog', 'plan', 'cal', 'sport', 'fight', 'titles', 'map', 'gps'].forEach(name => {
      this.views[name] = this.createPlaceholderView(name);
    });

    // Initialize all views
    Object.values(this.views).forEach(v => v.init?.());
  },

  createPlaceholderView(name) {
    const el = document.getElementById(`v${name.charAt(0).toUpperCase() + name.slice(1)}`) || document.getElementById(`v${name}`);
    return {
      name,
      el,
      initialized: false,
      async init() { this.initialized = true; },
      show() { this.el?.classList.add('active'); },
      hide() { this.el?.classList.remove('active'); },
      render() {
        if (this.el) {
          this.el.innerHTML = `
            <div class="card">
              <div class="card-title">${I18n.t('nav.${name}')}</div>
              <div class="empty">
                <p>Bu sahifa hali ishlab chiqilmoqda</p>
                <button class="btn btn-primary mt-2" onclick="App.navigate('today')">${I18n.t('nav.today')}</button>
              </div>
            </div>
          `;
        }
      }
    };
  },

  bindNavigation() {
    // Bottom nav buttons
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });

    // Handle browser back/forward
    window.addEventListener('popstate', e => {
      if (e.state?.view) {
        this.switchView(e.state.view, false);
      }
    });
  },

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
      el.textContent = I18n.t(key, params);
    });

    // Handle placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = I18n.t(key);
    });
  },

  onAuthChange(user) {
    if (user) {
      this.validateAndEnter();
    } else {
      this.showAuth();
    }
  },

  async validateAndEnter() {
    const valid = await Auth._validateSession();
    if (valid) {
      this.showApp();
      // Load data for default view
      await this.views.today.loadData();
    } else {
      this.showAuth();
    }
  },

  showAuth() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    this.hideAllViews();
    this.views.auth.show();
    this.currentView = 'auth';
  },

  showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    this.navigate('today', false);
  },

  navigate(viewName, pushState = true) {
    const route = this.routes[viewName];
    if (!route) {
      console.warn('Unknown view:', viewName);
      return;
    }

    // Check auth
    if (route.auth && !Auth.isAuthenticated()) {
      this.navigate('auth');
      return;
    }

    this.switchView(route.view, pushState);
  },

  switchView(viewName, pushState = true) {
    if (this.currentView === viewName) return;

    // Hide current
    if (this.currentView && this.views[this.currentView]) {
      this.views[this.currentView].hide();
    }

    // Show new
    const view = this.views[viewName];
    if (view) {
      view.show();
      view.render?.();
      this.currentView = viewName;
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Push state
    if (pushState) {
      history.pushState({ view: viewName }, '', `#${viewName}`);
    }

    // Update document title
    const titles = {
      today: 'Bugun',
      log: 'Jurnal',
      run: 'Yugurish',
      prog: 'Dastur',
      plan: 'Reja',
      food: 'Ovqat',
      settings: 'Sozlamalar',
      cal: 'Kalendar',
      sport: 'Sport',
      fight: 'Jang',
      leaderboard: 'Reyting',
      titles: 'Unvonlar',
      map: 'Xarita',
      gps: 'GPS'
    };
    document.title = `Fittnis • ${titles[viewName] || 'Fittnis'}`;
  },

  hideAllViews() {
    Object.values(this.views).forEach(v => v.hide?.());
  },

  async registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered');
      } catch (e) {
        console.warn('SW registration failed:', e);
      }
    }
  },

  // Global action handlers (called from inline onclick)
  editWorkout(id) {
    const workout = Store.get('workouts')?.find(w => w.id === id);
    if (workout) this.views.log.openModal(workout);
  },

  async deleteWorkout(id) {
    if (!confirm(I18n.t('common.confirm') + '?')) return;
    try {
      const token = await Auth.getValidToken();
      await API.deleteWorkout(token, id);
      await this.views.log.loadWorkouts();
      this.views.today.render();
    } catch (e) {
      alert(e.message);
    }
  },

  viewRun(id) {
    // Navigate to run detail or map view
    this.navigate('map');
  },

  async deleteRun(id) {
    if (!confirm(I18n.t('common.confirm') + '?')) return;
    try {
      const token = await Auth.getValidToken();
      // Need API.deleteRun - add if needed
      await this.views.today.loadTodayData();
    } catch (e) {
      alert(e.message);
    }
  },

  async deleteFood(id) {
    if (!confirm(I18n.t('common.confirm') + '?')) return;
    try {
      const token = await Auth.getValidToken();
      await API.deleteFoodLog(token, id);
      await this.views.food.loadFoodLogs();
      this.views.today.render();
    } catch (e) {
      alert(e.message);
    }
  }
};

// Global access for inline handlers
window.App = App;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Language change listener
window.addEventListener('langchange', () => {
  App.applyTranslations();
  Object.values(App.views).forEach(v => v.render?.());
});

export default App;