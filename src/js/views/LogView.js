/**
 * Log View - Workout journal with CRUD
 */
class LogView extends ViewBase {
  constructor() {
    super('log', document.getElementById('vLog'));
    this.editingId = null;
  }

  async loadData() {
    await this.loadWorkouts();
    this.watch('workouts', () => this.render());
  }

  async loadWorkouts() {
    this.setLoading('log', true);
    try {
      const token = await Auth.getValidToken();
      if (!token) return;
      const userId = Auth.getUserId();
      const workouts = await API.getWorkouts(token, userId);
      Store.set('workouts', workouts);
    } catch (e) {
      this.setError('log', e.message);
    } finally {
      this.setLoading('log', false);
    }
  }

  bindEvents() {
    // Add workout button
    this.$('#btnAddWorkout')?.addEventListener('click', () => this.openModal());

    // Form submit
    this.$('#workoutForm')?.addEventListener('submit', e => this.handleSubmit(e));

    // Modal close
    this.$('#workoutModalClose')?.addEventListener('click', () => this.closeModal());
    this.$('#workoutModalCancel')?.addEventListener('click', () => this.closeModal());
    this.$('#workoutModal')?.addEventListener('click', e => {
      if (e.target === this.$('#workoutModal')) this.closeModal();
    });
  }

  openModal(workout = null) {
    this.editingId = workout?.id || null;
    const form = this.$('#workoutForm');
    form.reset();

    if (workout) {
      this.$('#workoutName').value = workout.name || '';
      this.$('#workoutType').value = workout.type || 'strength';
      this.$('#workoutDate').value = workout.date || new Date().toISOString().split('T')[0];
      this.$('#workoutDuration').value = workout.duration || 0;
      this.$('#workoutCalories').value = workout.calories || 0;
      this.$('#workoutNotes').value = workout.notes || '';
      this.$('#workoutModalTitle').textContent = this.t('common.edit');
    } else {
      this.$('#workoutDate').value = new Date().toISOString().split('T')[0];
      this.$('#workoutModalTitle').textContent = this.t('log.add');
    }

    this.$('#workoutModal').classList.add('open');
    this.$('#workoutName').focus();
  }

  closeModal() {
    this.$('#workoutModal')?.classList.remove('open');
    this.editingId = null;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const data = {
      name: this.$('#workoutName').value.trim(),
      type: this.$('#workoutType').value,
      date: this.$('#workoutDate').value,
      duration: parseInt(this.$('#workoutDuration').value) || 0,
      calories: parseInt(this.$('#workoutCalories').value) || 0,
      notes: this.$('#workoutNotes').value.trim(),
      user_id: Auth.getUserId()
    };

    if (!data.name) return;

    this.setLoading('log', true);
    try {
      const token = await Auth.getValidToken();
      if (this.editingId) {
        await API.updateWorkout(token, this.editingId, data);
      } else {
        await API.createWorkout(token, data);
      }
      this.closeModal();
      await this.loadWorkouts();
    } catch (err) {
      this.setError('log', err.message);
    } finally {
      this.setLoading('log', false);
    }
  }

  render() {
    const workouts = Store.get('workouts') || [];
    const list = this.$('#workoutList');
    if (!list) return;

    if (workouts.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <h3>${this.t('log.empty')}</h3>
          <button class="btn btn-primary mt-2" onclick="App.views.log.openModal()">${this.t('log.add')}</button>
        </div>
      `;
      return;
    }

    list.innerHTML = workouts.map(w => `
      <div class="list-item" data-id="${w.id}">
        <div class="main">
          <div class="title">${this.escapeHtml(w.name)}</div>
          <div class="meta">${this.formatDate(w.date)} • ${w.type} • ${w.duration} ${this.t('unit.min')} • ${w.calories} ${this.t('unit.kcal')}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" onclick="App.views.log.openModal(${JSON.stringify(w).replace(/"/g, '"')})">${this.t('common.edit')}</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="App.deleteWorkout('${w.id}')">${this.t('common.delete')}</button>
        </div>
      </div>
    `).join('');
  }

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(I18n.currentLang === 'uz' ? 'uz-UZ' : I18n.currentLang === 'ru' ? 'ru-RU' : 'en-US');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.LogView = LogView;
export default LogView;