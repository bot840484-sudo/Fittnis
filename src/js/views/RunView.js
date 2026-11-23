/**
 * Run View - GPS tracking with timer
 */
class RunView extends ViewBase {
  constructor() {
    super('run', document.getElementById('vRun'));
    this.watchId = null;
    this.startTime = null;
    this.elapsed = 0;
    this.timerInterval = null;
    this.coords = [];
    this.running = false;
    this.paused = false;
  }

  bindEvents() {
    this.$('#btnRunStart')?.addEventListener('click', () => this.start());
    this.$('#btnRunPause')?.addEventListener('click', () => this.pause());
    this.$('#btnRunStop')?.addEventListener('click', () => this.stop());
    this.$('#btnRunSave')?.addEventListener('click', () => this.save());
    this.$('#btnRunDiscard')?.addEventListener('click', () => this.discard());

    // Map center button
    this.$('#btnMapCenter')?.addEventListener('click', () => this.centerMap());
  }

  onShow() {
    this.resetUI();
    this.initMap();
  }

  onHide() {
    this.stopGPS();
    this.stopTimer();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  resetUI() {
    this.running = false;
    this.paused = false;
    this.elapsed = 0;
    this.coords = [];
    this.updateTimerDisplay();
    this.$('#runStatus').textContent = this.t('run.start');
    this.$('#btnRunStart').classList.remove('hidden');
    this.$('#btnRunPause').classList.add('hidden');
    this.$('#btnRunStop').classList.add('hidden');
    this.$('#btnRunSave').classList.add('hidden');
    this.$('#btnRunDiscard').classList.add('hidden');
    this.$('#runDistance').textContent = '0.00';
    this.$('#runPace').textContent = '--:--';
    this.clearMapMarkers();
  }

  initMap() {
    if (typeof L === 'undefined') return;
    if (this.map) return;

    this.map = L.map('runMap').setView([41.311, 69.240], 15); // Tashkent default
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);
  }

  async start() {
    if (!navigator.geolocation) {
      this.setError('run', this.t('error.gps'));
      return;
    }

    this.running = true;
    this.paused = false;
    this.startTime = Date.now() - this.elapsed;
    this.coords = [];

    this.$('#runStatus').textContent = this.t('run.start');
    this.$('#btnRunStart').classList.add('hidden');
    this.$('#btnRunPause').classList.remove('hidden');
    this.$('#btnRunStop').classList.remove('hidden');

    this.startTimer();
    this.startGPS();
  }

  pause() {
    if (!this.running) return;

    this.paused = !this.paused;
    if (this.paused) {
      this.elapsed = Date.now() - this.startTime;
      this.stopTimer();
      this.stopGPS();
      this.$('#runStatus').textContent = this.t('run.pause');
      this.$('#btnRunPause').textContent = this.t('run.start');
    } else {
      this.startTime = Date.now() - this.elapsed;
      this.startTimer();
      this.startGPS();
      this.$('#runStatus').textContent = this.t('run.start');
      this.$('#btnRunPause').textContent = this.t('run.pause');
    }
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.stopTimer();
    this.stopGPS();

    this.$('#btnRunPause').classList.add('hidden');
    this.$('#btnRunStop').classList.add('hidden');
    this.$('#btnRunSave').classList.remove('hidden');
    this.$('#btnRunDiscard').classList.remove('hidden');
    this.$('#runStatus').textContent = this.t('run.stop');
  }

  discard() {
    this.resetUI();
  }

  async save() {
    if (this.coords.length < 2) {
      this.setError('run', this.t('error.gps'));
      return;
    }

    const distance = this.calculateDistance();
    const duration = Math.floor(this.elapsed / 1000);
    const calories = Math.round(distance * 65); // rough estimate

    const data = {
      user_id: Auth.getUserId(),
      date: new Date().toISOString().split('T')[0],
      started_at: new Date(this.startTime).toISOString(),
      ended_at: new Date().toISOString(),
      distance_km: distance,
      duration_sec: duration,
      calories: calories,
      coords: this.coords,
      pace_sec_per_km: distance > 0 ? duration / distance : 0
    };

    this.setLoading('run', true);
    try {
      const token = await Auth.getValidToken();
      await API.createRun(token, data);
      this.resetUI();
      App.navigate('log');
    } catch (e) {
      this.setError('run', e.message);
    } finally {
      this.setLoading('run', false);
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.elapsed = Date.now() - this.startTime;
      this.updateTimerDisplay();
      this.updatePace();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const h = Math.floor(this.elapsed / 3600000);
    const m = Math.floor((this.elapsed % 3600000) / 60000);
    const s = Math.floor((this.elapsed % 60000) / 1000);
    this.$('#runTimer').textContent =
      (h > 0 ? h + ':' : '') + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  }

  updatePace() {
    const distance = this.calculateDistance();
    if (distance > 0 && this.elapsed > 0) {
      const paceSec = (this.elapsed / 1000) / distance;
      const m = Math.floor(paceSec / 60);
      const s = Math.floor(paceSec % 60);
      this.$('#runPace').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
  }

  startGPS() {
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.onGPSUpdate(pos),
      err => this.onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
  }

  stopGPS() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  onGPSUpdate(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    this.coords.push({ lat: latitude, lng: longitude, accuracy, time: Date.now() });
    this.updateMap(latitude, longitude);
    this.$('#runDistance').textContent = this.calculateDistance().toFixed(2);
  }

  onGPSError(err) {
    console.warn('GPS error:', err);
  }

  updateMap(lat, lng) {
    if (!this.map) return;

    // Add/update current position marker
    if (!this.currentMarker) {
      this.currentMarker = L.marker([lat, lng], { icon: this.runnerIcon() }).addTo(this.map);
    } else {
      this.currentMarker.setLatLng([lat, lng]);
    }

    // Draw path
    if (this.coords.length > 1) {
      const latlngs = this.coords.map(c => [c.lat, c.lng]);
      if (!this.pathLayer) {
        this.pathLayer = L.polyline(latlngs, { color: '#58a6ff', weight: 4, opacity: 0.8 }).addTo(this.map);
      } else {
        this.pathLayer.setLatLngs(latlngs);
      }
    }

    // Auto-center if following
    if (this.$('#chkFollowMap')?.checked) {
      this.map.panTo([lat, lng]);
    }
  }

  centerMap() {
    if (this.map && this.currentMarker) {
      this.map.setView(this.currentMarker.getLatLng(), 16);
    }
  }

  clearMapMarkers() {
    if (this.pathLayer) {
      this.map.removeLayer(this.pathLayer);
      this.pathLayer = null;
    }
    if (this.currentMarker) {
      this.map.removeLayer(this.currentMarker);
      this.currentMarker = null;
    }
  }

  runnerIcon() {
    return L.divIcon({
      className: 'runner-marker',
      html: '<div style="width:20px;height:20px;background:#58a6ff;border-radius:50%;border:3px solid #0d1117;box-shadow:0 0 10px #58a6ff;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  calculateDistance() {
    let dist = 0;
    for (let i = 1; i < this.coords.length; i++) {
      dist += this.haversine(this.coords[i-1], this.coords[i]);
    }
    return dist; // km
  }

  haversine(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}

window.RunView = RunView;
export default RunView;