/**
 * Food View - Food diary with AI photo analysis
 */
class FoodView extends ViewBase {
  constructor() {
    super('food', document.getElementById('vFood'));
    this.selectedFile = null;
  }

  async loadData() {
    await this.loadFoodLogs();
    this.watch('foodLogs', () => this.render());
    this.watch('dailyNutrition', () => this.renderSummary());
  }

  async loadFoodLogs() {
    this.setLoading('food', true);
    try {
      const token = await Auth.getValidToken();
      if (!token) return;
      const userId = Auth.getUserId();
      const date = Store.get('currentDate');
      const logs = await API.getFoodLogs(token, userId, date);
      Store.set('foodLogs', logs);
      this.calculateNutrition(logs);
    } catch (e) {
      this.setError('food', e.message);
    } finally {
      this.setLoading('food', false);
    }
  }

  calculateNutrition(logs) {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    logs.forEach(f => {
      totals.calories += f.calories || 0;
      totals.protein += f.protein || 0;
      totals.carbs += f.carbs || 0;
      totals.fat += f.fat || 0;
    });
    Store.set('dailyNutrition', totals);
  }

  bindEvents() {
    // Add food button
    this.$('#btnAddFood')?.addEventListener('click', () => this.openModal());

    // Form submit
    this.$('#foodForm')?.addEventListener('submit', e => this.handleSubmit(e));

    // Photo upload
    this.$('#foodPhoto')?.addEventListener('change', e => this.handlePhoto(e));
    this.$('#btnAnalyzeFood')?.addEventListener('click', () => this.analyzePhoto());

    // Modal close
    this.$('#foodModalClose')?.addEventListener('click', () => this.closeModal());
    this.$('#foodModalCancel')?.addEventListener('click', () => this.closeModal());
    this.$('#foodModal')?.addEventListener('click', e => {
      if (e.target === this.$('#foodModal')) this.closeModal();
    });
  }

  openModal(food = null) {
    this.editingId = food?.id || null;
    const form = this.$('#foodForm');
    form.reset();
    this.selectedFile = null;
    this.$('#foodPhotoPreview').classList.add('hidden');
    this.$('#foodPhotoPreview img').src = '';

    if (food) {
      this.$('#foodName').value = food.name || '';
      this.$('#foodCalories').value = food.calories || 0;
      this.$('#foodProtein').value = food.protein || 0;
      this.$('#foodCarbs').value = food.carbs || 0;
      this.$('#foodFat').value = food.fat || 0;
      this.$('#foodPortion').value = food.portion || 100;
      this.$('#foodDate').value = food.date || new Date().toISOString().split('T')[0];
      this.$('#foodNotes').value = food.notes || '';
      this.$('#foodModalTitle').textContent = this.t('common.edit');
    } else {
      this.$('#foodDate').value = new Date().toISOString().split('T')[0];
      this.$('#foodPortion').value = 100;
      this.$('#foodModalTitle').textContent = this.t('food.add');
    }

    this.$('#foodModal').classList.add('open');
    this.$('#foodName').focus();
  }

  closeModal() {
    this.$('#foodModal')?.classList.remove('open');
    this.editingId = null;
    this.selectedFile = null;
  }

  handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.setError('food', this.t('error.camera'));
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      this.$('#foodPhotoPreview img').src = ev.target.result;
      this.$('#foodPhotoPreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  async analyzePhoto() {
    if (!this.selectedFile) return;

    this.setLoading('food', true);
    this.$('#btnAnalyzeFood').disabled = true;
    this.$('#btnAnalyzeFood').textContent = this.t('common.loading');

    try {
      // Convert to base64
      const base64 = await this.fileToBase64(this.selectedFile);

      const token = await Auth.getValidToken();
      const result = await API.aiAnalyzeFood(token, base64, 'Analyze this food photo and return JSON with name, calories, protein, carbs, fat per 100g');

      if (result?.name) this.$('#foodName').value = result.name;
      if (result?.calories) this.$('#foodCalories').value = result.calories;
      if (result?.protein) this.$('#foodProtein').value = result.protein;
      if (result?.carbs) this.$('#foodCarbs').value = result.carbs;
      if (result?.fat) this.$('#foodFat').value = result.fat;
      if (result?.portion) this.$('#foodPortion').value = result.portion;

    } catch (e) {
      this.setError('food', e.message || this.t('error.unknown'));
    } finally {
      this.setLoading('food', false);
      this.$('#btnAnalyzeFood').disabled = false;
      this.$('#btnAnalyzeFood').textContent = this.t('food.analyze');
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async handleSubmit(e) {
    e.preventDefault();
    const portion = parseFloat(this.$('#foodPortion').value) || 100;
    const factor = portion / 100;

    const data = {
      name: this.$('#foodName').value.trim(),
      calories: Math.round((parseFloat(this.$('#foodCalories').value) || 0) * factor),
      protein: Math.round((parseFloat(this.$('#foodProtein').value) || 0) * factor * 10) / 10,
      carbs: Math.round((parseFloat(this.$('#foodCarbs').value) || 0) * factor * 10) / 10,
      fat: Math.round((parseFloat(this.$('#foodFat').value) || 0) * factor * 10) / 10,
      portion: portion,
      date: this.$('#foodDate').value,
      notes: this.$('#foodNotes').value.trim(),
      user_id: Auth.getUserId()
    };

    if (!data.name) return;

    this.setLoading('food', true);
    try {
      const token = await Auth.getValidToken();
      if (this.editingId) {
        await API.updateWorkout(token, this.editingId, data); // Reuse endpoint or create new
      } else {
        await API.createFoodLog(token, data);
      }
      this.closeModal();
      await this.loadFoodLogs();
    } catch (err) {
      this.setError('food', err.message);
    } finally {
      this.setLoading('food', false);
    }
  }

  render() {
    const logs = Store.get('foodLogs') || [];
    const list = this.$('#foodList');
    if (!list) return;

    this.renderSummary();

    if (logs.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <h3>${this.t('food.empty')}</h3>
          <button class="btn btn-primary mt-2" onclick="App.views.food.openModal()">${this.t('food.add')}</button>
        </div>
      `;
      return;
    }

    list.innerHTML = logs.map(f => `
      <div class="list-item" data-id="${f.id}">
        <div class="main">
          <div class="title">${this.escapeHtml(f.name)}</div>
          <div class="meta">${f.portion}g • ${f.calories} ${this.t('unit.kcal')} • P:${f.protein}g C:${f.carbs}g F:${f.fat}g</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" onclick="App.views.food.openModal(${JSON.stringify(f).replace(/"/g, '"')})">${this.t('common.edit')}</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="App.deleteFood('${f.id}')">${this.t('common.delete')}</button>
        </div>
      </div>
    `).join('');
  }

  renderSummary() {
    const nutrition = Store.get('dailyNutrition') || {};
    this.$('#foodCaloriesTotal').textContent = nutrition.calories || 0;
    this.$('#foodProteinTotal').textContent = (nutrition.protein || 0).toFixed(1);
    this.$('#foodCarbsTotal').textContent = (nutrition.carbs || 0).toFixed(1);
    this.$('#foodFatTotal').textContent = (nutrition.fat || 0).toFixed(1);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.FoodView = FoodView;
export default FoodView;