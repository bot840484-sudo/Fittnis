/**
 * Leaderboard View - Ratings and rankings
 */
class LeaderboardView extends ViewBase {
  constructor() {
    super('leaderboard', document.getElementById('vStatus')); // Using vStatus as leaderboard view
    this.refreshInterval = null;
  }

  async loadData() {
    await this.loadLeaderboard();
    this.watch('leaderboard', () => this.render());
    this.watch('myRank', () => this.renderMyRank());
  }

  onShow() {
    this.loadLeaderboard();
    // Auto-refresh every 5 minutes
    this.refreshInterval = setInterval(() => this.loadLeaderboard(), 300000);
  }

  onHide() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  bindEvents() {
    this.$('#btnRefreshLeaderboard')?.addEventListener('click', () => this.loadLeaderboard());
    this.$('#lbTabAll')?.addEventListener('click', () => this.switchTab('all'));
    this.$('#lbTabWeek')?.addEventListener('click', () => this.switchTab('week'));
    this.$('#lbTabMonth')?.addEventListener('click', () => this.switchTab('month'));
  }

  switchTab(tab) {
    this.currentTab = tab;
    this.$$('#lbTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this.loadLeaderboard(tab);
  }

  async loadLeaderboard(period = 'all') {
    this.setLoading('leaderboard', true);
    try {
      const token = await Auth.getValidToken();
      if (!token) return;

      // Try RPC function first, fallback to manual calculation
      let data;
      try {
        data = await API.getLeaderboard(token, 50);
      } catch (e) {
        // Fallback: compute from user_stats table
        data = await this.computeLeaderboardManual(token);
      }

      Store.set('leaderboard', data || []);

      // Get my rank
      const userId = Auth.getUserId();
      try {
        const myRank = await API.getMyRank(token, userId);
        Store.set('myRank', myRank);
      } catch (e) {
        // Compute locally
        const lb = Store.get('leaderboard') || [];
        const myEntry = lb.find(e => e.user_id === userId);
        Store.set('myRank', myEntry ? { rank: lb.indexOf(myEntry) + 1, ...myEntry } : null);
      }
    } catch (e) {
      this.setError('leaderboard', e.message);
    } finally {
      this.setLoading('leaderboard', false);
    }
  }

  async computeLeaderboardManual(token) {
    // Fetch all user stats and compute rankings
    const { data: stats } = await fetch(`${API.supabaseUrl}/rest/v1/user_stats?select=*,profiles(full_name,avatar_url)`, {
      headers: API._sbHeaders()
    }).then(r => r.json());

    if (!stats) return [];

    // Calculate scores
    const scored = stats.map(s => ({
      ...s,
      score: this.calculateScore(s),
      user_id: s.user_id
    }));

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // Add ranks
    return scored.map((s, i) => ({ ...s, rank: i + 1 }));
  }

  calculateScore(stats) {
    // Weighted scoring: workouts * 10 + runs * 15 + streak * 5 + total_time/3600 * 2
    const workouts = stats.total_workouts || 0;
    const runs = stats.total_runs || 0;
    const streak = stats.current_streak || 0;
    const hours = (stats.total_active_minutes || 0) / 60;
    return workouts * 10 + runs * 15 + streak * 5 + hours * 2;
  }

  render() {
    const lb = Store.get('leaderboard') || [];
    const list = this.$('#leaderboardList');
    const empty = this.$('#leaderboardEmpty');
    const loading = Store.get('loading')?.leaderboard;

    this.$$('#leaderboardLoading').forEach(el => el.classList.toggle('hidden', !loading));

    if (loading) return;

    if (lb.length === 0) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    list.innerHTML = lb.slice(0, 50).map((entry, i) => this.renderRow(entry, i)).join('');
  }

  renderRow(entry, index) {
    const isMe = entry.user_id === Auth.getUserId();
    const rank = index + 1;
    let rankClass = '';
    let rankIcon = rank;
    if (rank === 1) { rankClass = 'gold'; rankIcon = '🥇'; }
    else if (rank === 2) { rankClass = 'silver'; rankIcon = '🥈'; }
    else if (rank === 3) { rankClass = 'bronze'; rankIcon = '🥉'; }

    const name = entry.profiles?.full_name || entry.user_id?.slice(0, 8) || 'User';
    const avatar = entry.profiles?.avatar_url || this.getInitials(name);

    return `
      <div class="lb-row ${isMe ? 'lb-my' : ''}" data-user="${entry.user_id}">
        <div class="lb-rank ${rankClass}">${rankIcon}</div>
        <div class="lb-avatar" style="background: ${this.getColor(name)}">${avatar}</div>
        <div class="lb-info">
          <div class="lb-name">${this.escapeHtml(name)}${isMe ? ' <span class="badge badge-primary">Siz</span>' : ''}</div>
          <div class="lb-stats">${entry.total_workouts || 0} ${this.t('lb.workouts')} • ${entry.total_runs || 0} ${this.t('lb.runs')} • ${entry.current_streak || 0} ${this.t('lb.streak')}</div>
        </div>
        <div class="lb-score">${entry.score || 0}</div>
      </div>
    `;
  }

  renderMyRank() {
    const myRank = Store.get('myRank');
    const container = this.$('#myRankCard');
    if (!container) return;

    if (!myRank) {
      container.innerHTML = `
        <div class="card">
          <div class="card-title">${this.t('lb.myRank')}</div>
          <div class="empty" style="padding:20px;">
            <p>${this.t('lb.empty')}</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card ${myRank.rank ? '' : ''}">
        <div class="card-title">${this.t('lb.myRank')}</div>
        <div class="lb-row lb-my" style="margin:0;">
          <div class="lb-rank ${myRank.rank === 1 ? 'gold' : myRank.rank === 2 ? 'silver' : myRank.rank === 3 ? 'bronze' : ''}">${myRank.rank || '—'}</div>
          <div class="lb-avatar" style="background: ${this.getColor('Me')}">${this.getInitials('Me')}</div>
          <div class="lb-info">
            <div class="lb-name">Siz</div>
            <div class="lb-stats">${myRank.total_workouts || 0} ${this.t('lb.workouts')} • ${myRank.total_runs || 0} ${this.t('lb.runs')} • ${myRank.current_streak || 0} ${this.t('lb.streak')}</div>
          </div>
          <div class="lb-score">${myRank.score || 0}</div>
        </div>
      </div>
    `;
  }

  getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.LeaderboardView = LeaderboardView;
export default LeaderboardView;