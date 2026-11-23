/**
 * Settings View - Profile, units, language, backup, export/import
 */
class SettingsView extends ViewBase {
  constructor() {
    super('settings', document.getElementById('vSet'));
  }

  async loadData() {
    await this.loadSettings();
    this.watch('settings', () => this.render());
    this.watch('profile', () => this.renderProfile());
  }

  async loadSettings() {
    this.setLoading('settings', true);
    try {
      const token = await Auth.getValidToken();
      if (!token) return;
      const userId = Auth.getUserId();
      const settings = await API.getSettings(token, userId);
      Store.set('settings', settings[0] || {});
      Store.set('profile', Auth.user);
    } catch (e) {
      this.setError('settings', e.message);
    } finally {
      this.setLoading('settings', false);
    }
  }

  bindEvents() {
    // Form submit
    this.$('#settingsForm')?.addEventListener('submit', e => this.handleSave(e));

    // Language change
    this.$('#settingLanguage')?.addEventListener('change', e => this.changeLanguage(e.target.value));

    // Units change
    this.$('#settingUnits')?.addEventListener('change', e => this.saveSettings({ units: e.target.value }));

    // Export
    this.$('#btnExport')?.addEventListener('click', () => this.exportData());

    // Import
    this.$('#settingImport')?.addEventListener('change', e => this.importData(e));

    // Clear data
    this.$('#btnClearData')?.addEventListener('click', () => this.confirmClearData());

    // Logout
    this.$('#btnLogout')?.addEventListener('click', () => Auth.signOut());
  }

  async handleSave(e) {
    e.preventDefault();
    const data = {
      user_id: Auth.getUserId(),
      full_name: this.$('#settingName').value.trim(),
      height_cm: parseFloat(this.$('#settingHeight').value) || null,
      weight_kg: parseFloat(this.$('#settingWeight').value) || null,
      birth_date: this.$('#settingBirthDate').value || null,
      gender: this.$('#settingGender').value || null,
      goal: this.$('#settingGoal').value || null,
      activity_level: this.$('#settingActivity').value || null,
      units: this.$('#settingUnits').value || 'metric',
      language: this.$('#settingLanguage').value || 'uz'
    };

    this.setLoading('settings', true);
    try {
      const token = await Auth.getValidToken();
      await API.upsertSettings(token, data);
      Store.update('settings', data);
      // Update profile in auth
      if (Auth.user) {
        Auth.user = { ...Auth.user, user_metadata: { ...Auth.user.user_metadata, full_name: data.full_name } };
        Auth._saveSession();
      }
      this.showToast(this.t('common.success'));
    } catch (err) {
      this.setError('settings', err.message);
    } finally {
      this.setLoading('settings', false);
    }
  }

  async changeLanguage(lang) {
    I18n.setLang(lang);
    await this.saveSettings({ language: lang });
    // Refresh all views
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = I18n.t(key);
    });
    // Re-render current view
    Object.values(App.views).forEach(v => v.render?.());
  }

  async saveSettings(partial) {
    const data = { user_id: Auth.getUserId(), ...Store.get('settings'), ...partial };
    try {
      const token = await Auth.getValidToken();
      await API.upsertSettings(token, data);
      Store.set('settings', data);
    } catch (e) {
      console.error('Save settings error:', e);
    }
  }

  render() {
    const settings = Store.get('settings') || {};
    const profile = Store.get('profile') || {};

    this.$('#settingName').value = profile.user_metadata?.full_name || settings.full_name || '';
    this.$('#settingEmail').value = profile.email || '';
    this.$('#settingHeight').value = settings.height_cm || '';
    this.$('#settingWeight').value = settings.weight_kg || '';
    this.$('#settingBirthDate').value = settings.birth_date || '';
    this.$('#settingGender').value = settings.gender || '';
    this.$('#settingGoal').value = settings.goal || '';
    this.$('#settingActivity').value = settings.activity_level || '';
    this.$('#settingUnits').value = settings.units || 'metric';
    this.$('#settingLanguage').value = settings.language || 'uz';
  }

  renderProfile() {
    const profile = Store.get('profile') || {};
    this.$('#settingEmail').value = profile.email || '';
    this.$('#profileAvatar').textContent = this.getInitials(profile.user_metadata?.full_name || profile.email || 'U');
  }

  exportData() {
    const data = {
      workouts: Store.get('workouts') || [],
      runs: Store.get('runs') || [],
      foodLogs: Store.get('foodLogs') || [],
      settings: Store.get('settings') || {},
      exportDate: new Date().toISOString(),
      version: '2.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittnis-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(this.t('common.success'));
  }

  importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('Invalid backup format');

        const token = await Auth.getValidToken();
        // Import workouts
        if (data.workouts?.length) {
          for (const w of data.workouts) {
            await API.createWorkout(token, { ...w, user_id: Auth.getUserId() });
          }
        }
        // Import runs
        if (data.runs?.length) {
          for (const r of data.runs) {
            await API.createRun(token, { ...r, user_id: Auth.getUserId() });
          }
        }
        // Import food
        if (data.foodLogs?.length) {
          for (const f of data.foodLogs) {
            await API.createFoodLog(token, { ...f, user_id: Auth.getUserId() });
          }
        }
        // Import settings
        if (data.settings) {
          await API.upsertSettings(token, { ...data.settings, user_id: Auth.getUserId() });
        }

        this.showToast(this.t('common.success'));
        // Reload all
        Object.values(App.views).forEach(v => v.loadData?.());
      } catch (err) {
        this.showToast(this.t('error.unknown'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  confirmClearData() {
    if (confirm(this.t('common.confirm') + '? ' + this.t('set.clearData'))) {
      this.clearAllData();
    }
  }

  async clearAllData() {
    this.setLoading('settings', true);
    try {
      const token = await Auth.getValidToken();
      const userId = Auth.getUserId();

      // Delete all user data via RPC or batch
      // For now, just clear local storage
      Storage.clearAppData();
      Store.reset();
      this.showToast(this.t('common.success'));
    } catch (e) {
      this.showToast(this.t('error.unknown'), 'error');
    } finally {
      this.setLoading('settings', false);
    }
  }

  getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  showToast(msg, type = 'success') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:var(--panel);border:1px solid var(--border);padding:12px 24px;
      border-radius:8px;box-shadow:var(--shadow);z-index:1000;
      animation:slideUp .3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideUp .3s ease reverse'; setTimeout(() => toast.remove(), 300); }, 3000);
  }
}

window.SettingsView = SettingsView;
export default SettingsView;