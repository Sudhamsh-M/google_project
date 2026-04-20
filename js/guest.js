/* ============================================
   AEGIS — Guest Page Logic
   Push Notifications & Evacuation Guidance
   ============================================ */

const GuestApp = {
  room: null,
  floor: null,
  pushSubscription: null,
  statusInterval: null,
  currentStatus: 'green',
  swRegistration: null,

  async init() {
    this.setupListeners();
    
    // 1. Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const magicRoom = params.get('magic_room');

    // 0. Force logout if parameter exists (for testing)
    if (params.get('logout')) {
      localStorage.removeItem('aegis_room');
      console.log('[AEGIS] Session cleared via logout parameter');
    }

    if (magicRoom) {
      const autoIdentified = await this.handleAutoCheckIn(magicRoom);
      if (autoIdentified) {
        this.finishLogin();
        return;
      }
    }

    // 2. Fallback to existing session or manual check-in
    const identified = await this.checkIdentity();
    if (identified) {
      this.finishLogin();
    }
  },

  async handleAutoCheckIn(roomNum) {
    try {
      const res = await fetch('/api/guest/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: roomNum })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('aegis_room', data.room);
        this.room = data.room;
        this.floor = `Floor ${data.floor}`;
        console.log(`[MAGIC] Zero-Touch identity verified: Room ${this.room}`);
        return true;
      }
    } catch (e) {
      console.error('[MAGIC] Auto-verification bridge failed');
    }
    return false;
  },

  setupListeners() {
    document.getElementById('verify-btn')?.addEventListener('click', () => this.handleCheckIn());
    document.getElementById('room-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleCheckIn();
    });
  },

  async checkIdentity() {
    const storedRoom = localStorage.getItem('aegis_room');
    if (storedRoom) {
      try {
        const res = await fetch('/api/guest/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomNumber: storedRoom })
        });
        const data = await res.json();
        if (data.success) {
          this.room = data.room;
          this.floor = `Floor ${data.floor}`;
          return true;
        }
      } catch (e) {
        console.warn('Identity verification failed, forcing re-check-in');
      }
    }
    return false;
  },

  async handleCheckIn() {
    const roomInput = document.getElementById('room-input');
    const verifyBtn = document.getElementById('verify-btn');
    const errorEl = document.getElementById('checkin-error');
    
    const roomNum = roomInput.value.trim();
    if (!roomNum) return;

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    errorEl.style.display = 'none';

    try {
      const res = await fetch('/api/guest/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: roomNum })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('aegis_room', data.room);
        this.room = data.room;
        this.floor = `Floor ${data.floor}`;
        
        // Premium hide animation
        document.getElementById('checkin-overlay').classList.add('hidden');
        setTimeout(() => {
          document.getElementById('checkin-overlay').style.display = 'none';
          this.finishLogin();
        }, 500);
      } else {
        errorEl.textContent = 'Invalid room number. Please check with reception.';
        errorEl.style.display = 'block';
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Identity';
      }
    } catch (e) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.style.display = 'block';
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Identity';
    }
  },

  async finishLogin() {
    document.getElementById('checkin-overlay').style.display = 'none';
    this.renderRoomInfo();
    await this.registerServiceWorker();
    this.renderNotifCard();
    this.renderInfoCards();
    this.startStatusPolling();
    this.listenForServiceWorkerMessages();
    console.log('%c AEGIS GUEST %c Session Active ', 'background: #3b82f6; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;', 'background: #0f1526; color: #94a3b8; padding: 4px 8px; border-radius: 0 4px 4px 0;');
  },

  // --- Render room info in header ---
  renderRoomInfo() {
    const roomEl = document.getElementById('guest-room-display');
    if (roomEl) {
      roomEl.textContent = `Room ${this.room} · ${this.floor}`;
    }
  },

  // --- Service Worker Registration ---
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', this.swRegistration.scope);
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  },

  // --- Listen for messages from SW ---
  listenForServiceWorkerMessages() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'CRISIS_ALERT') {
        this.handleCrisisAlert(event.data.data);
      }
      if (event.data?.type === 'ALERT_ACKNOWLEDGED') {
        this.showAckConfirmation();
      }
    });
  },

  // --- Notification Permission ---
  renderNotifCard() {
    const card = document.getElementById('notif-card');
    if (!card) return;

    if (!('Notification' in window) || !('PushManager' in window)) {
      card.innerHTML = `
        <div class="notif-icon">⚠️</div>
        <div class="notif-title">Notifications Not Supported</div>
        <div class="notif-desc">Your browser does not support push notifications. Please use Chrome, Firefox, or Edge for the best experience.</div>
        <button class="notif-btn denied-btn" disabled>Not Available</button>
      `;
      card.classList.add('denied');
      return;
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
      this.showNotifGranted(card);
      this.subscribeToPush();
    } else if (permission === 'denied') {
      this.showNotifDenied(card);
    } else {
      this.showNotifPrompt(card);
    }
  },

  showNotifPrompt(card) {
    card.innerHTML = `
      <div class="notif-icon">🔔</div>
      <div class="notif-title">Enable Safety Alerts</div>
      <div class="notif-desc">Allow notifications so we can alert you instantly during an emergency. This could save your life in a crisis situation.</div>
      <button class="notif-btn enable" id="btn-enable-notif">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        Enable Emergency Alerts
      </button>
    `;

    document.getElementById('btn-enable-notif')?.addEventListener('click', () => {
      this.requestNotifPermission(card);
    });
  },

  async requestNotifPermission(card) {
    const btn = document.getElementById('btn-enable-notif');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <div style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.7s linear infinite"></div>
        Requesting...
      `;
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        this.showNotifGranted(card);
        await this.subscribeToPush();
      } else {
        this.showNotifDenied(card);
      }
    } catch (err) {
      console.error('Notification permission error:', err);
      this.showNotifDenied(card);
    }
  },

  showNotifGranted(card) {
    card.classList.add('granted');
    card.innerHTML = `
      <div class="notif-icon">✅</div>
      <div class="notif-title">Safety Alerts Enabled</div>
      <div class="notif-desc">You will receive instant notifications during any emergency. Stay safe — we've got you covered.</div>
      <button class="notif-btn success" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Alerts Active
      </button>
    `;
  },

  showNotifDenied(card) {
    card.classList.add('denied');
    card.innerHTML = `
      <div class="notif-icon">🔕</div>
      <div class="notif-title">Alerts Blocked</div>
      <div class="notif-desc">Notifications are blocked. To enable them, tap the lock icon in your browser's address bar and allow notifications for this site.</div>
      <button class="notif-btn denied-btn" disabled>Notifications Blocked</button>
    `;
  },

  // --- Push Subscription ---
  async subscribeToPush() {
    if (!this.swRegistration) {
      console.warn('No SW registration, cannot subscribe');
      return;
    }

    try {
      // Get VAPID public key from server
      const response = await fetch('/api/guest/vapid-public-key');
      if (!response.ok) throw new Error('Failed to get VAPID key');
      const { publicKey } = await response.json();

      // Convert VAPID key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(publicKey);

      // Subscribe to push
      this.pushSubscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      // Send subscription to server
      await fetch('/api/guest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: this.pushSubscription.toJSON(),
          room: this.room,
          floor: this.floor,
        }),
      });

      console.log('Push subscription successful');
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  },


  // --- Convert VAPID key ---
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },

  // --- Status Polling ---
  startStatusPolling() {
    this.fetchStatus();
    this.statusInterval = setInterval(() => this.fetchStatus(), 5000);
  },

  async fetchStatus() {
    try {
      const res = await fetch('/api/guest/status');
      if (!res.ok) return;
      const data = await res.json();

      this.updateStatusBar(data.threatLevel);

      // If evacuation or lockdown is active, trigger crisis mode
      if (data.evacuationActive || data.lockdownActive) {
        if (!document.body.classList.contains('crisis-mode')) {
          this.enterCrisisMode(data);
        }
      } else if (document.body.classList.contains('crisis-mode') && data.allClear) {
        this.exitCrisisMode();
      }
    } catch (err) {
      // Silently fail — user might be offline
    }
  },

  updateStatusBar(level) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    dot.className = `status-dot ${level}`;

    const labels = {
      green: 'All Clear — You are safe',
      amber: 'Elevated Alert — Stay informed',
      red: 'Emergency Active — Stay alert',
    };

    text.textContent = labels[level] || labels.green;
    text.className = `status-text ${level}`;
    this.currentStatus = level;
  },

  // --- Crisis Mode ---
  async handleCrisisAlert(data) {
    if (!document.body.classList.contains('crisis-mode')) {
      this.enterCrisisMode(data);
    }
  },

  async enterCrisisMode(data) {
    document.body.classList.add('crisis-mode');

    // Update crisis banner
    const crisisTitle = document.getElementById('crisis-title');
    const crisisType = document.getElementById('crisis-type');
    const crisisTime = document.getElementById('crisis-time');

    if (crisisTitle) crisisTitle.textContent = 'EMERGENCY';
    if (crisisType) {
      const typeLabel = data?.crisisType || data?.type || 'Emergency situation in progress';
      crisisType.textContent = typeLabel;
    }
    if (crisisTime) crisisTime.textContent = `Alert issued: ${new Date().toLocaleTimeString()}`;

    // Update status bar
    this.updateStatusBar('red');

    // Fetch AI evacuation guidance
    this.loadEvacuationGuidance(data);
  },

  async loadEvacuationGuidance(data) {
    const stepsContainer = document.getElementById('evac-steps');
    if (!stepsContainer) return;

    // Show loading
    stepsContainer.innerHTML = `
      <div class="evac-loading">
        <div class="spinner"></div>
        Generating evacuation route for Room ${this.room}...
      </div>
    `;

    try {
      const res = await fetch('/api/guest/evacuation-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: this.room,
          floor: this.floor,
          crisisType: data?.crisisType || data?.type || 'general emergency',
          severity: data?.severity || 'high',
        }),
      });

      if (!res.ok) throw new Error('Failed to get evacuation guidance');
      const result = await res.json();

      const steps = result.steps || this.getFallbackSteps();
      this.renderEvacSteps(steps);
    } catch (err) {
      console.error('Evacuation guidance error:', err);
      this.renderEvacSteps(this.getFallbackSteps());
    }
  },

  renderEvacSteps(steps) {
    const stepsContainer = document.getElementById('evac-steps');
    if (!stepsContainer) return;

    stepsContainer.innerHTML = steps.map((step, i) => `
      <div class="evac-step">
        <div class="evac-step-num">${i + 1}</div>
        <div class="evac-step-text">${step}</div>
      </div>
    `).join('');
  },

  getFallbackSteps() {
    return [
      `Leave Room ${this.room} immediately. Do not use elevators.`,
      `Proceed to the nearest stairwell on ${this.floor}.`,
      'Walk calmly but quickly to the ground floor.',
      'Exit through the nearest emergency exit to the assembly point.',
      'Report to hotel staff at the assembly area for a headcount.',
    ];
  },

  exitCrisisMode() {
    document.body.classList.remove('crisis-mode');
    this.updateStatusBar('green');
  },

  showAckConfirmation() {
    // Show a brief confirmation toast on the guest page
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4);
      color: #22c55e; padding: 12px 24px; border-radius: 12px; font-size: 0.85rem;
      font-weight: 600; backdrop-filter: blur(16px); z-index: 9999;
      animation: fadeInUp 0.3s ease-out;
    `;
    toast.textContent = '✓ Alert acknowledged';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // --- Info Cards ---
  renderInfoCards() {
    const container = document.getElementById('info-section');
    if (!container) return;

    container.innerHTML = `
      <div class="info-card">
        <div class="info-icon blue">🏨</div>
        <div class="info-content">
          <div class="info-label">Your Location</div>
          <div class="info-value">${this.floor}, Room ${this.room}</div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon green">🚪</div>
        <div class="info-content">
          <div class="info-label">Nearest Exit</div>
          <div class="info-value">${this.getNearestExit()}</div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon amber">🧯</div>
        <div class="info-content">
          <div class="info-label">Fire Equipment</div>
          <div class="info-value">${this.getNearestFireEquip()}</div>
        </div>
      </div>
    `;
  },

  getNearestExit() {
    const roomNum = parseInt(this.room);
    if (isNaN(roomNum)) return 'Main Lobby Exit';
    if (roomNum % 10 <= 5) return 'Stairwell A (West End)';
    return 'Stairwell B (East End)';
  },

  getNearestFireEquip() {
    const roomNum = parseInt(this.room);
    if (isNaN(roomNum)) return 'Lobby corridor, near reception';
    if (roomNum % 10 <= 5) return `${this.floor} corridor, near Room ${Math.floor(roomNum / 10) * 10 + 3}`;
    return `${this.floor} corridor, near Room ${Math.floor(roomNum / 10) * 10 + 8}`;
  },
};

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  GuestApp.init();
});
