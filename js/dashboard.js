/* ============================================
   AEGIS — Dashboard View
   ============================================ */

const DashboardView = {
  alertFeedEl: null,
  metricsInterval: null,

  render() {
    const container = document.getElementById('view-dashboard');
    const activeIncidents = Simulator.incidents.filter(i => i.status !== 'resolved');
    const criticalCount = activeIncidents.filter(i => i.severity === 'critical').length;
    const respondingStaff = Simulator.staff.filter(s => s.status === 'responding' || s.status === 'engaged').length;
    const availableStaff = Simulator.staff.filter(s => s.status === 'available').length;

    container.innerHTML = `
      <div class="dashboard-grid stagger-children">
        <!-- Metric Cards Row -->
        <div class="metric-card red" id="metric-active">
          <div class="metric-icon red">${Icons.incidents}</div>
          <div class="metric-value" id="active-count">${activeIncidents.length}</div>
          <div class="metric-label">Active Incidents</div>
          <div class="metric-change up">
            ${Icons.arrowUp} ${criticalCount} critical
          </div>
        </div>

        <div class="metric-card amber" id="metric-responding">
          <div class="metric-icon amber">${Icons.activity}</div>
          <div class="metric-value" id="responding-count">${respondingStaff}</div>
          <div class="metric-label">Staff Responding</div>
          <div class="metric-change" style="color: var(--text-tertiary)">of ${Simulator.staff.filter(s => s.status !== 'off-duty').length} on duty</div>
        </div>

        <div class="metric-card green" id="metric-available">
          <div class="metric-icon green">${Icons.personnel}</div>
          <div class="metric-value" id="available-count">${availableStaff}</div>
          <div class="metric-label">Available Staff</div>
          <div class="metric-change down">Ready to deploy</div>
        </div>

        <div class="metric-card blue" id="metric-guests">
          <div class="metric-icon blue">${Icons.user}</div>
          <div class="metric-value" id="guest-count">${Simulator.guestCount}</div>
          <div class="metric-label">Guests On-Site</div>
          <div class="metric-change" style="color: var(--severity-low)">
            ${Icons.checkCircle} All accounted
          </div>
        </div>

        <!-- Threat Gauge -->
        <div class="threat-gauge-container">
          <div class="card-header" style="width:100%; margin-bottom: 0;">
            <div class="card-title">Threat Level</div>
            <div class="threat-badge ${Simulator.threatLevel}" id="threat-badge-main">
              <div class="dot ${Simulator.threatLevel === 'red' ? 'pulse-critical' : ''}"></div>
              ${Simulator.threatLevel.toUpperCase()}
            </div>
          </div>
          <div class="threat-gauge" id="threat-gauge">
            <canvas id="gauge-canvas" width="220" height="130"></canvas>
          </div>
          <div class="threat-levels">
            <div class="threat-level-item">
              <div class="threat-level-dot" style="background: var(--severity-low)"></div>
              Low
            </div>
            <div class="threat-level-item">
              <div class="threat-level-dot" style="background: var(--severity-medium)"></div>
              Elevated
            </div>
            <div class="threat-level-item">
              <div class="threat-level-dot" style="background: var(--severity-high)"></div>
              High
            </div>
            <div class="threat-level-item">
              <div class="threat-level-dot" style="background: var(--severity-critical)"></div>
              Critical
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Quick Actions</div>
          </div>
          <div class="quick-actions-grid">
            <button class="quick-action-btn lockdown" onclick="DashboardView.handleLockdown()" id="btn-lockdown">
              ${Icons.lock}
              <span>Lockdown</span>
            </button>
            <button class="quick-action-btn evacuate" onclick="DashboardView.handleEvacuate()" id="btn-evacuate">
              ${Icons.logOut}
              <span>Evacuate</span>
            </button>
            <button class="quick-action-btn all-clear" onclick="DashboardView.handleAllClear()" id="btn-allclear">
              ${Icons.checkCircle}
              <span>All Clear</span>
            </button>
            <button class="quick-action-btn backup" onclick="DashboardView.handleBackup()" id="btn-backup">
              ${Icons.phone}
              <span>Req. Backup</span>
            </button>
          </div>
        </div>

        <!-- Guest Notifications -->
        <div class="guest-notifications">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Guest Notifications</div>
            <div class="flex items-center gap-sm">
              <div class="status-dot available" id="guest-notif-dot"></div>
              <span class="text-xs text-tertiary" id="guest-sub-count">0 guests</span>
            </div>
          </div>
          <div class="quick-actions-grid">
            <button class="quick-action-btn qr-code" onclick="DashboardView.showQRModal()" id="btn-qr-code">
              ${Icons.building}
              <span>Room QR</span>
            </button>
            <button class="quick-action-btn alert-guests" onclick="DashboardView.showGuestAlertModal()" id="btn-alert-guests">
              ${Icons.bell}
              <span>Alert Guests</span>
            </button>
          </div>
        </div>

        <!-- Simulation Controls -->
        <div class="simulation-controls">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Simulation Controls</div>
          </div>
          <div class="quick-actions-grid">
            <button class="quick-action-btn auto-gen ${Simulator.autoGenerate ? 'active' : ''}" onclick="DashboardView.toggleAutoGenerate()" id="btn-auto-gen">
              ${Icons.activity}
              <span>${Simulator.autoGenerate ? 'Auto Events' : 'Manual Only'}</span>
            </button>
            <button class="quick-action-btn trigger-event" onclick="DashboardView.triggerManualEvent()" id="btn-trigger-event">
              ${Icons.zap}
              <span>Trigger Event</span>
            </button>
          </div>
        </div>

        <!-- Alert Feed -->
        <div class="alert-feed">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Live Alert Feed</div>
            <div class="flex items-center gap-sm">
              <div class="status-dot available pulse-green"></div>
              <span class="text-xs text-tertiary">LIVE</span>
            </div>
          </div>
          <div class="alert-feed-list" id="alert-feed-list">
            ${this.renderAlertFeed()}
          </div>
        </div>

        <!-- Response Metrics -->
        <div class="metrics-row">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Response Metrics</div>
          </div>
          <div class="metrics-bar-group">
            <div class="metric-bar-item">
              <div class="metric-bar-label">Avg. Response</div>
              <div class="metric-bar-track">
                <div class="metric-bar-fill blue" style="width: 72%" id="bar-response"></div>
              </div>
              <div class="metric-bar-value" id="val-response">2m 34s</div>
            </div>
            <div class="metric-bar-item">
              <div class="metric-bar-label">Resolution Rate</div>
              <div class="metric-bar-track">
                <div class="metric-bar-fill green" style="width: 85%" id="bar-resolution"></div>
              </div>
              <div class="metric-bar-value" id="val-resolution">85%</div>
            </div>
            <div class="metric-bar-item">
              <div class="metric-bar-label">Staff Coverage</div>
              <div class="metric-bar-track">
                <div class="metric-bar-fill amber" style="width: 68%" id="bar-coverage"></div>
              </div>
              <div class="metric-bar-value" id="val-coverage">68%</div>
            </div>
            <div class="metric-bar-item">
              <div class="metric-bar-label">Sensor Health</div>
              <div class="metric-bar-track">
                <div class="metric-bar-fill green" style="width: 96%" id="bar-sensors"></div>
              </div>
              <div class="metric-bar-value" id="val-sensors">96%</div>
            </div>
          </div>
        </div>

        <!-- Emergency Services Status -->
        <div class="services-status">
          <div class="card-header" style="margin-bottom: 0;">
            <div class="card-title">Emergency Services</div>
          </div>
          <div class="services-grid">
            <div class="service-item">
              <div class="service-icon" style="background: var(--severity-critical-dim); color: var(--severity-critical);">
                ${Icons.flame}
              </div>
              <div class="service-info">
                <div class="service-name">Fire Department</div>
                <div class="service-desc">Station 7 — 1.2 mi</div>
              </div>
              <div class="service-status connected">Connected</div>
            </div>
            <div class="service-item">
              <div class="service-icon" style="background: var(--accent-blue-dim); color: var(--accent-blue);">
                ${Icons.shield}
              </div>
              <div class="service-info">
                <div class="service-name">Police</div>
                <div class="service-desc">District 14 — 0.8 mi</div>
              </div>
              <div class="service-status connected">Connected</div>
            </div>
            <div class="service-item">
              <div class="service-icon" style="background: var(--severity-high-dim); color: var(--severity-high);">
                ${Icons.ambulance}
              </div>
              <div class="service-info">
                <div class="service-name">Paramedics</div>
                <div class="service-desc">County EMS — Dispatched</div>
              </div>
              <div class="service-status standby">En Route</div>
            </div>
            <div class="service-item">
              <div class="service-icon" style="background: var(--severity-medium-dim); color: var(--severity-medium);">
                ${Icons.siren}
              </div>
              <div class="service-info">
                <div class="service-name">Hazmat</div>
                <div class="service-desc">Regional Unit — 4.5 mi</div>
              </div>
              <div class="service-status standby">Standby</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.drawGauge();
    this.bindEvents();
    this.fetchGuestCount();
  },

  renderAlertFeed() {
    // Combine recent incidents as alerts
    const alerts = [...Simulator.incidents]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 15)
      .map(inc => `
        <div class="alert-item ${inc.severity}">
          <div class="alert-item-icon">
            ${Icons[INCIDENT_TYPES[inc.type]?.icon] || Icons.alertCircle}
          </div>
          <div class="alert-item-content">
            <div class="alert-item-title">${inc.title}</div>
            <div class="alert-item-desc">${inc.location}</div>
          </div>
          <div class="alert-item-time">${Utils.formatRelative(inc.createdAt)}</div>
        </div>
      `).join('');

    return alerts || '<div class="empty-state"><p>No alerts</p></div>';
  },

  drawGauge() {
    const canvas = document.getElementById('gauge-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = 110;
    const centerY = 110;
    const radius = 90;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;

    ctx.clearRect(0, 0, 220, 130);

    // Track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#141c32';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Fill
    const score = Simulator.threatScore / 100;
    const fillAngle = startAngle + (endAngle - startAngle) * score;

    const gradient = ctx.createLinearGradient(0, 0, 220, 0);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(0.4, '#eab308');
    gradient.addColorStop(0.7, '#f97316');
    gradient.addColorStop(1, '#ef4444');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, fillAngle);
    ctx.lineWidth = 14;
    ctx.strokeStyle = gradient;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '900 32px Inter, sans-serif';
    ctx.fillText(Simulator.threatScore, centerX, centerY + 5);
    ctx.font = '500 10px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('THREAT SCORE', centerX, centerY + 22);
  },

  bindEvents() {
    EventBus.on('new-alert', (alert) => this.addAlert(alert));
    EventBus.on('threat-update', () => this.updateThreatDisplay());
    EventBus.on('staff-update', () => this.updateMetrics());
    EventBus.on('incident-update', () => this.updateMetrics());
    EventBus.on('new-incident', () => this.updateMetrics());
    EventBus.on('evacuation-update', (data) => this.updateGuestCount(data));
  },

  addAlert(alert) {
    const list = document.getElementById('alert-feed-list');
    if (!list) return;

    const iconKey = INCIDENT_TYPES[alert.type]?.icon || 'alertCircle';
    const html = `
      <div class="alert-item ${alert.severity}" style="animation: slideInDown 0.3s ease-out;">
        <div class="alert-item-icon">
          ${Icons[iconKey] || Icons.alertCircle}
        </div>
        <div class="alert-item-content">
          <div class="alert-item-title">${alert.title}</div>
          <div class="alert-item-desc">${alert.location}</div>
        </div>
        <div class="alert-item-time">Just now</div>
      </div>
    `;
    list.insertAdjacentHTML('afterbegin', html);
    // Keep max 20 alerts
    while (list.children.length > 20) {
      list.removeChild(list.lastChild);
    }
  },
  updateThreatDisplay() {
    this.drawGauge();
    const badge = document.getElementById('threat-badge-main');
    if (badge) {
      badge.className = `threat-badge ${Simulator.threatLevel}`;
      badge.innerHTML = `<div class="dot ${Simulator.threatLevel === 'red' ? 'pulse-critical' : ''}"></div>${Simulator.threatLevel.toUpperCase()}`;
    }
  },

  updateMetrics() {
    const activeIncidents = Simulator.incidents.filter(i => i.status !== 'resolved');
    const el = (id) => document.getElementById(id);

    if (el('active-count')) el('active-count').textContent = activeIncidents.length;
    if (el('responding-count')) el('responding-count').textContent = Simulator.staff.filter(s => s.status === 'responding' || s.status === 'engaged').length;
    if (el('available-count')) el('available-count').textContent = Simulator.staff.filter(s => s.status === 'available').length;
  },

  updateGuestCount(data) {
    const el = document.getElementById('guest-count');
    if (el) el.textContent = `${data.accounted}/${data.total}`;
  },

  handleLockdown() {
    Simulator.triggerLockdown();
    const btn = document.getElementById('btn-lockdown');
    if (btn) {
      btn.classList.add('pulse-critical');
      btn.innerHTML = `${Icons.lock}<span>ACTIVE</span>`;
    }
    // Notify guests via push
    this.notifyGuests({
      title: '🚨 LOCKDOWN — Grand Meridian Hotel',
      body: 'LOCKDOWN IN EFFECT. Lock your door and stay inside your room. Do not open for anyone except hotel security. Await further instructions.',
      severity: 'critical',
      type: 'lockdown',
      crisisType: 'Lockdown',
    });
  },

  handleEvacuate() {
    Simulator.triggerEvacuation();
    const btn = document.getElementById('btn-evacuate');
    if (btn) {
      btn.classList.add('pulse-warning');
      btn.innerHTML = `${Icons.logOut}<span>IN PROGRESS</span>`;
    }
    // Notify guests via push
    this.notifyGuests({
      title: '🚨 EVACUATE NOW — Grand Meridian Hotel',
      body: 'EVACUATION ORDER. Leave your room immediately. Use stairs ONLY. Proceed to the nearest exit. Open the AEGIS app for your personal evacuation route.',
      severity: 'critical',
      type: 'evacuation',
      crisisType: 'Evacuation',
    });
  },

  handleAllClear() {
    Simulator.triggerAllClear();
    document.getElementById('btn-lockdown')?.classList.remove('pulse-critical');
    document.getElementById('btn-evacuate')?.classList.remove('pulse-warning');
    // Notify guests
    this.notifyGuests({
      title: '✅ ALL CLEAR — Grand Meridian Hotel',
      body: 'The emergency has been resolved. It is now safe to return to your room. Thank you for your cooperation.',
      severity: 'low',
      type: 'all-clear',
      crisisType: 'All Clear',
    });
  },

  handleBackup() {
    Simulator.requestBackup();
    const btn = document.getElementById('btn-backup');
    if (btn) {
      btn.classList.add('pulse-blue');
      setTimeout(() => btn.classList.remove('pulse-blue'), 5000);
    }
  },

  toggleAutoGenerate() {
    const enabled = Simulator.toggleAutoGenerate();
    const btn = document.getElementById('btn-auto-gen');
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.innerHTML = `${Icons.activity}<span>${enabled ? 'Auto Events' : 'Manual Only'}</span>`;
    }
    Toast.show('info', 'Simulation Mode', enabled ? 'Auto event generation enabled' : 'Auto event generation disabled');
  },

  triggerManualEvent() {
    Simulator.triggerManualAlert();
    const btn = document.getElementById('btn-trigger-event');
    if (btn) {
      btn.classList.add('pulse-blue');
      setTimeout(() => btn.classList.remove('pulse-blue'), 1000);
    }
  },

  // --- Guest Notification Methods ---

  async fetchGuestCount() {
    try {
      const res = await fetch('/api/guest/count');
      if (!res.ok) return;
      const data = await res.json();
      const countEl = document.getElementById('guest-sub-count');
      if (countEl) countEl.textContent = `${data.count} guest${data.count !== 1 ? 's' : ''}`;
    } catch { /* silently fail */ }
  },

  async notifyGuests(payload) {
    try {
      // Also update server status
      await fetch('/api/guest/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatLevel: Simulator.threatLevel,
          evacuationActive: Simulator.evacuationActive,
          lockdownActive: Simulator.lockdownActive,
          allClear: payload.type === 'all-clear',
          activeIncidents: Simulator.incidents.filter(i => i.status !== 'resolved').length,
        }),
      });

      const res = await fetch('/api/guest/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const data = await res.json();
      Toast.show('info', 'Guest Alert Sent', `Notified ${data.sent} of ${data.total} guests`);
    } catch (err) {
      console.error('Guest notify error:', err);
    }
  },

  showQRModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-content');
    if (!overlay || !modal) return;

    const host = window.location.origin;

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Room QR Codes</div>
        <button class="modal-close" onclick="App.closeModal()">${Icons.x}</button>
      </div>
      <div style="margin-bottom: 16px;">
        <label class="form-label">Select Floor</label>
        <select class="form-select" id="qr-floor-select" onchange="DashboardView.updateQRRoomList()">
          ${FLOORS.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom: 16px;">
        <label class="form-label">Select Room</label>
        <select class="form-select" id="qr-room-select" onchange="DashboardView.generateQR()">
          ${ROOMS[FLOORS[0]].map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <div id="qr-code-display" style="display: inline-block; padding: 16px; background: white; border-radius: 12px;"></div>
        <div id="qr-url-display" style="margin-top: 12px; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-tertiary); word-break: break-all;"></div>
      </div>
      <div style="text-align: center;">
        <button class="btn btn-primary" onclick="DashboardView.printQR()" id="btn-print-qr">
          Print QR Code
        </button>
      </div>
    `;

    overlay.classList.add('active');
    this.generateQR();
  },

  updateQRRoomList() {
    const floor = document.getElementById('qr-floor-select')?.value;
    const roomSelect = document.getElementById('qr-room-select');
    if (!floor || !roomSelect) return;

    roomSelect.innerHTML = (ROOMS[floor] || []).map(r => `<option value="${r}">${r}</option>`).join('');
    this.generateQR();
  },

  generateQR() {
    const floor = document.getElementById('qr-floor-select')?.value || 'Lobby';
    const room = document.getElementById('qr-room-select')?.value || '101';
    const host = window.location.origin;
    const floorParam = floor.replace('Floor ', '');
    const url = `${host}/guest?room=${room}&floor=${floorParam}`;

    const display = document.getElementById('qr-code-display');
    const urlDisplay = document.getElementById('qr-url-display');
    if (!display) return;

    // Generate QR using a simple table-based QR renderer
    if (typeof qrcode !== 'undefined') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      display.innerHTML = qr.createSvgTag(5, 0);
    } else {
      // Fallback: show URL as text with a styled placeholder
      display.innerHTML = `
        <div style="width: 180px; height: 180px; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc; border-radius: 8px; color: #666; font-size: 0.75rem; text-align: center; padding: 12px;">
          QR Library Loading...<br><br>
          <a href="${url}" target="_blank" style="color: #3b82f6; word-break: break-all;">${url}</a>
        </div>
      `;
    }

    if (urlDisplay) urlDisplay.textContent = url;
  },

  printQR() {
    const qrDisplay = document.getElementById('qr-code-display');
    if (!qrDisplay) return;

    const floor = document.getElementById('qr-floor-select')?.value || '';
    const room = document.getElementById('qr-room-select')?.value || '';

    const printWindow = window.open('', '_blank', 'width=400,height=500');
    printWindow.document.write(`
      <html>
      <head><title>AEGIS QR — Room ${room}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Inter, sans-serif; }
        h2 { margin-bottom: 8px; }
        p { color: #666; margin-bottom: 20px; }
        .qr { padding: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #999; }
      </style>
      </head>
      <body>
        <h2>Grand Meridian Hotel</h2>
        <p>${floor} — Room ${room}</p>
        <div class="qr">${qrDisplay.innerHTML}</div>
        <p style="font-size: 13px;">Scan for emergency safety alerts</p>
        <div class="footer">AEGIS Crisis Response System</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  },

  showGuestAlertModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-content');
    if (!overlay || !modal) return;

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Send Guest Alert</div>
        <button class="modal-close" onclick="App.closeModal()">${Icons.x}</button>
      </div>
      <div class="form-group">
        <label class="form-label">Alert Title</label>
        <input class="form-input" id="alert-title-input" placeholder="e.g. Emergency Evacuation Notice" />
      </div>
      <div class="form-group">
        <label class="form-label">Message</label>
        <textarea class="form-textarea" id="alert-body-input" rows="3" placeholder="Describe the situation and instructions for guests..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Severity</label>
        <select class="form-select" id="alert-severity-input">
          <option value="low">Low — Informational</option>
          <option value="medium">Medium — Advisory</option>
          <option value="high" selected>High — Urgent</option>
          <option value="critical">Critical — Life Safety</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px; padding-top: 8px;">
        <button class="btn btn-ghost" onclick="App.closeModal()" style="flex: 1;">Cancel</button>
        <button class="btn btn-danger" onclick="DashboardView.sendCustomGuestAlert()" style="flex: 1;" id="btn-send-alert">
          ${Icons.send} Send Alert
        </button>
      </div>
    `;

    overlay.classList.add('active');
  },

  async sendCustomGuestAlert() {
    const title = document.getElementById('alert-title-input')?.value;
    const body = document.getElementById('alert-body-input')?.value;
    const severity = document.getElementById('alert-severity-input')?.value;

    if (!title || !body) {
      Toast.show('warning', 'Missing Fields', 'Please enter a title and message.');
      return;
    }

    const btn = document.getElementById('btn-send-alert');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Sending...';
    }

    await this.notifyGuests({
      title: `🔔 ${title}`,
      body: body,
      severity: severity,
      type: 'alert',
      crisisType: title,
    });

    App.closeModal();
  },
};
