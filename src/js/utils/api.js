/**
 * API utility - Supabase client and AI proxy calls
 * All sensitive keys should be in environment variables / backend proxy
 */
const API = {
  // Supabase config - URL is public, key should be anon key only
  supabaseUrl: 'https://vobzqkxoqiwpwngervqg.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYnpxa3hvcWl3cHduZ2VydnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzYwNjQsImV4cCI6MjA1MTQ1MjA2NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8E', // REPLACE with your actual anon key

  // Backend proxy URL for AI calls (to be deployed separately)
  // This keeps API keys out of frontend
  aiProxyUrl: '', // e.g., 'https://your-proxy.vercel.app/api/ai'

  // Headers for Supabase
  _sbHeaders() {
    return {
      'apikey': this.supabaseAnonKey,
      'Authorization': `Bearer ${this.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
  },

  // Auth headers with user token
  _authHeaders(token) {
    return {
      'apikey': this.supabaseAnonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  // Generic fetch with error handling
  async _fetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      console.error('API error:', e);
      throw e;
    }
  },

  // ===== AUTH =====
  async signUp(email, password, metadata = {}) {
    return this._fetch(`${this.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: this._sbHeaders(),
      body: JSON.stringify({ email, password, data: metadata })
    });
  },

  async signIn(email, password) {
    return this._fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this._sbHeaders(),
      body: JSON.stringify({ email, password })
    });
  },

  async signOut(token) {
    return this._fetch(`${this.supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: this._authHeaders(token)
    });
  },

  async refreshToken(refreshToken) {
    return this._fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: this._sbHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  },

  async getUser(token) {
    return this._fetch(`${this.supabaseUrl}/auth/v1/user`, {
      headers: this._authHeaders(token)
    });
  },

  // ===== DATABASE (RLS protected) =====
  // Table: workouts
  async getWorkouts(token, userId) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/workouts?user_id=eq.${userId}&order=date.desc`, {
      headers: this._authHeaders(token)
    });
  },

  async createWorkout(token, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/workouts`, {
      method: 'POST',
      headers: this._authHeaders(token),
      body: JSON.stringify(data)
    });
  },

  async updateWorkout(token, id, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/workouts?id=eq.${id}`, {
      method: 'PATCH',
      headers: this._authHeaders(token),
      body: JSON.stringify(data)
    });
  },

  async deleteWorkout(token, id) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/workouts?id=eq.${id}`, {
      method: 'DELETE',
      headers: this._authHeaders(token)
    });
  },

  // Table: runs (GPS tracks)
  async getRuns(token, userId) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/runs?user_id=eq.${userId}&order=started_at.desc`, {
      headers: this._authHeaders(token)
    });
  },

  async createRun(token, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/runs`, {
      method: 'POST',
      headers: this._authHeaders(token),
      body: JSON.stringify(data)
    });
  },

  // Table: food_logs
  async getFoodLogs(token, userId, date) {
    let url = `${this.supabaseUrl}/rest/v1/food_logs?user_id=eq.${userId}&order=logged_at.desc`;
    if (date) url += `&date=eq.${date}`;
    return this._fetch(url, { headers: this._authHeaders(token) });
  },

  async createFoodLog(token, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/food_logs`, {
      method: 'POST',
      headers: this._authHeaders(token),
      body: JSON.stringify(data)
    });
  },

  async deleteFoodLog(token, id) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/food_logs?id=eq.${id}`, {
      method: 'DELETE',
      headers: this._authHeaders(token)
    });
  },

  // Table: user_settings
  async getSettings(token, userId) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/user_settings?user_id=eq.${userId}&select=*`, {
      headers: this._authHeaders(token)
    });
  },

  async upsertSettings(token, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/user_settings`, {
      method: 'POST',
      headers: { ...this._authHeaders(token), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(data)
    });
  },

  // Table: user_stats (for leaderboard)
  async getUserStats(token, userId) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}&select=*`, {
      headers: this._authHeaders(token)
    });
  },

  async upsertUserStats(token, data) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/user_stats`, {
      method: 'POST',
      headers: { ...this._authHeaders(token), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(data)
    });
  },

  // ===== LEADERBOARD =====
  async getLeaderboard(token, limit = 50) {
    // Uses a Postgres function or view for efficient ranking
    return this._fetch(`${this.supabaseUrl}/rest/v1/rpc/get_leaderboard?limit=${limit}`, {
      method: 'POST',
      headers: this._authHeaders(token)
    });
  },

  async getMyRank(token, userId) {
    return this._fetch(`${this.supabaseUrl}/rest/v1/rpc/get_user_rank?p_user_id=${userId}`, {
      method: 'POST',
      headers: this._authHeaders(token)
    });
  },

  // ===== AI PROXY (secure - keys on backend) =====
  async aiGenerateWorkout(token, prompt, userProfile) {
    if (!this.aiProxyUrl) throw new Error('AI proxy not configured');
    return this._fetch(`${this.aiProxyUrl}/workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt, profile: userProfile })
    });
  },

  async aiAnalyzeFood(token, imageBase64, prompt) {
    if (!this.aiProxyUrl) throw new Error('AI proxy not configured');
    return this._fetch(`${this.aiProxyUrl}/food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ image: imageBase64, prompt })
    });
  },

  async aiChat(token, messages) {
    if (!this.aiProxyUrl) throw new Error('AI proxy not configured');
    return this._fetch(`${this.aiProxyUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ messages })
    });
  }
};

window.API = API;
export default API;