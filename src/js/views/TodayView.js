/**
 * Today View - Dashboard with stats, quick actions
 */
class TodayView extends ViewBase {
  constructor() {
    super('today', document.getElementById('vToday'));
    this.date = new Date().toISOString().split('T')[0];
  }

  async loadData() {
    await this.loadTodayData();
    this.watch('workouts', () => this.render());
    this.watch('runs', () => this.render());
    this.watch('foodLogs', () => this.render());
    this.watch('dailyNutrition', () => this.render());
  }

  async loadTodayData() {
    this.setLoading('today', true);
    try {
      const token = await Auth.getValidToken();
      if (!token) return;

      const userId = Auth.getUserId();
      const date = Store.get('currentDate') || this.date;

      // Load workouts for today
      const workouts = await API.getWorkouts(token, userId);
      Store.set('workouts', workouts.filter(w => w.date === date));

      // Load runs for today
      const runs = await API.getRuns(token, userId);
      Store.set('runs', runs.filter(r => r.date === date));

      // Load food logs for today
      const foodLogs = await API.getFoodLogs(token, userId, date);
      Store.set('foodLogs', foodLogs);

      // Calculate nutrition
      this.calculateNutrition(foodLogs);
    } catch (e) {
      this.setError('today', e.message);
    } finally {
      this.setLoading('today', false);
    }
  }

  calculateNutrition(foodLogs) {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    foodLogs.forEach(f => {
      totals.calories += f.calories || 0;
      totals.protein += f.protein || 0;
      totals.carbs += f.carbs || 0;
      totals.fat += f.fat || 0;
    });
    Store.set('dailyNutrition', totals);
  }

  bindEvents() {
    // Quick action buttons
    this.$('#btnAddWorkout')?.addEventListener('click', () => App.navigate('log', { action: 'add' }));
    this.$('#btnAddRun')?.addEventListener('click', () => App.navigate('run'));
    this.$('#btnAddFood')?.addEventListener('click', () => App.navigate('food', { action: 'add' }));

    // Date change
    this.$('#todayDate')?.addEventListener('change', e => {
      Store.set('currentDate', e.target.value);
      this.loadTodayData();
    });
  }

  onShow() {
    this.$('#todayDate').value = Store.get('currentDate') || this.date;
    this.render();
  }

  render() {
    const workouts = Store.get('workouts') || [];
    const runs = Store.get('runs') || [];
    const nutrition = Store.get('dailyNutrition') || {};
    const loading = Store.get('loading')?.today;

    // Stats
    const totalCalories = workouts.reduce((s, w) => s + (w.calories || 0), 0) + nutrition.calories;
    const totalProtein = nutrition.protein;
    const totalCarbs = nutrition.carbs;
    const totalFat = nutrition.fat;
    const totalWorkouts = workouts.length + runs.length;

    this.$('#statCalories').textContent = totalCalories;
    this.$('#statProtein').textContent = totalProtein.toFixed(1);
    this.$('#statCarbs').textContent = totalCarbs.toFixed(1);
    this.$('#statFat').textContent = totalFat.toFixed(1);
    this.$('#statWorkouts').textContent = totalWorkouts;

    // Workouts list
    const workoutList = this.$('#todayWorkouts');
    if (workoutList) {
      if (workouts.length === 0 && runs.length === 0) {
        workoutList.innerHTML = `
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <h3>${this.t('today.noWorkout')}</h3>
            <p>${this.t('today.addWorkout')} yoki ${this.t('today.addRun')}</p>
          </div>
        `;
      } else {
        workoutList.innerHTML = [
          ...workouts.map(w => this.renderWorkoutItem(w)),
          ...runs.map(r => this.renderRunItem(r))
        ].join('');
      }
    }

    // Loading state
    this.$$('#todayLoading').forEach(el => el.classList.toggle('hidden', !loading));
  }

  renderWorkoutItem(w) {
    return `
      <div class="list-item" data-id="${w.id}">
        <div class="main">
          <div class="title">${this.escapeHtml(w.name || this.t('log.workout'))}</div>
          <div class="meta">${w.type || ''} • ${w.duration || 0} ${this.t('unit.min')} • ${w.calories || 0} ${this.t('unit.kcal')}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" onclick="App.editWorkout('${w.id}')">${this.t('common.edit')}</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="App.deleteWorkout('${w.id}')">${this.t('common.delete')}</button>
        </div>
      </div>
    `;
  }

  renderRunItem(r) {
    return `
      <div class="list-item" data-id="${r.id}">
        <div class="main">
          <div class="title">🏃 ${this.t('nav.run')}</div>
          <div class="meta">${(r.distance || 0).toFixed(2)} ${this.t('unit.km')} • ${this.formatTime(r.duration || 0)} • ${r.calories || 0} ${this.t('unit.kcal')}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" onclick="App.viewRun('${r.id}')">${this.t('common.edit')}</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="App.deleteRun('${r.id}')">${this.t('common.delete')}</button>
        </div>
      </div>
    `;
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.TodayView = TodayView;
export default TodayView;