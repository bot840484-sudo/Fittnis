/**
 * Auth utility - manages user session, tokens, and auth state
 */
const Auth = {
  // Current auth state
  user: null,
  session: null,
  token: null,
  refreshToken: null,

  // Callbacks
  _onAuthChange: null,

  init() {
    // Restore from storage
    const stored = Storage.get('fittnis_session', 'local');
    if (stored && stored.token) {
      this.token = stored.token;
      this.refreshToken = stored.refreshToken;
      this.user = stored.user;
      this.session = stored;
      // Validate token by fetching user
      this._validateSession();
    }
    return this.user !== null;
  },

  async _validateSession() {
    if (!this.token) return false;
    try {
      const user = await API.getUser(this.token);
      this.user = user;
      this._saveSession();
      this._notifyChange();
      return true;
    } catch (e) {
      // Try refresh
      if (this.refreshToken) {
        return this._tryRefresh();
      }
      this.clear();
      return false;
    }
  },

  async _tryRefresh() {
    try {
      const session = await API.refreshToken(this.refreshToken);
      this.token = session.access_token;
      this.refreshToken = session.refresh_token;
      this.user = session.user;
      this.session = session;
      this._saveSession();
      this._notifyChange();
      return true;
    } catch (e) {
      this.clear();
      return false;
    }
  },

  _saveSession() {
    const data = {
      token: this.token,
      refreshToken: this.refreshToken,
      user: this.user,
      expiresAt: Date.now() + 3600000 // 1 hour
    };
    Storage.set('fittnis_session', data, 'local');
  },

  _notifyChange() {
    if (this._onAuthChange) this._onAuthChange(this.user);
  },

  onAuthChange(callback) {
    this._onAuthChange = callback;
  },

  async signUp(email, password, metadata = {}) {
    const session = await API.signUp(email, password, metadata);
    this.token = session.access_token;
    this.refreshToken = session.refresh_token;
    this.user = session.user;
    this.session = session;
    this._saveSession();
    this._notifyChange();
    return session;
  },

  async signIn(email, password) {
    const session = await API.signIn(email, password);
    this.token = session.access_token;
    this.refreshToken = session.refresh_token;
    this.user = session.user;
    this.session = session;
    this._saveSession();
    this._notifyChange();
    return session;
  },

  async signOut() {
    if (this.token) {
      try { await API.signOut(this.token); } catch (e) { console.warn('Signout error:', e); }
    }
    this.clear();
  },

  clear() {
    this.user = null;
    this.session = null;
    this.token = null;
    this.refreshToken = null;
    Storage.remove('fittnis_session', 'local');
    this._notifyChange();
  },

  isAuthenticated() {
    return !!this.token && !!this.user;
  },

  getUserId() {
    return this.user?.id || null;
  },

  // Get valid token (refresh if needed)
  async getValidToken() {
    if (!this.token) return null;
    // Check expiry (rough check)
    if (this.session?.expiresAt && Date.now() > this.session.expiresAt - 300000) {
      await this._tryRefresh();
    }
    return this.token;
  }
};

window.Auth = Auth;
export default Auth;