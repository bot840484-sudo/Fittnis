/**
 * Auth View - Login and Register
 */
class AuthView extends ViewBase {
  constructor() {
    super('auth', document.getElementById('authScreen'));
    this.mode = 'login'; // 'login' | 'register'
  }

  bindEvents() {
    // Tab switching
    this.$$('#authTabs .auth-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchMode(tab.dataset.mode));
    });

    // Forms
    this.$('#loginForm').addEventListener('submit', e => this.handleLogin(e));
    this.$('#registerForm').addEventListener('submit', e => this.handleRegister(e));
  }

  switchMode(mode) {
    this.mode = mode;
    this.$$('#authTabs .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    this.$('#loginForm').classList.toggle('hidden', mode !== 'login');
    this.$('#registerForm').classList.toggle('hidden', mode !== 'register');
    this.clearError('auth');
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = this.$('#loginEmail').value.trim();
    const password = this.$('#loginPassword').value;

    if (!email || !password) {
      this.setError('auth', this.t('auth.error.invalid'));
      return;
    }

    this.setLoading('auth', true);
    this.clearError('auth');

    try {
      await Auth.signIn(email, password);
      // Auth.onAuthChange will handle navigation
    } catch (err) {
      this.setError('auth', err.message || this.t('auth.error.invalid'));
    } finally {
      this.setLoading('auth', false);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = this.$('#regName').value.trim();
    const email = this.$('#regEmail').value.trim();
    const password = this.$('#regPassword').value;
    const confirm = this.$('#regConfirm').value;

    if (!name || !email || !password) {
      this.setError('auth', this.t('auth.error.invalid'));
      return;
    }
    if (password.length < 6) {
      this.setError('auth', this.t('auth.error.weakPassword'));
      return;
    }
    if (password !== confirm) {
      this.setError('auth', this.t('auth.error.invalid')); // reuse
      return;
    }

    this.setLoading('auth', true);
    this.clearError('auth');

    try {
      await Auth.signUp(email, password, { full_name: name });
    } catch (err) {
      this.setError('auth', err.message || this.t('auth.error.emailExists'));
    } finally {
      this.setLoading('auth', false);
    }
  }
}

window.AuthView = AuthView;
export default AuthView;