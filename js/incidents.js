/* ============================================
   AEGIS — Incident Management View
   ============================================ */

const IncidentView = {
  selectedIncident: null,

  render() {
    const container = document.getElementById('view-incidents');
    const byStatus = {
      reported: Simulator.incidents.filter(i => i.status === 'reported'),
      acknowledged: Simulator.incidents.filter(i => i.status === 'acknowledged'),
      'in-progress': Simulator.incidents.filter(i => i.status === 'in-progress'),
      resolved: Simulator.incidents.filter(i => i.status === 'resolved'),
    };

    container.innerHTML = `
      <div class="incident-header">
        <div class="incident-stats">
          <div class="incident-stat">
            <div class="incident-stat-value" style="color: var(--severity-critical)">${byStatus.reported.length}</div>
            <div class="incident-stat-label">Reported</div>
          </div>
          <div class="incident-stat">
            <div class="incident-stat-value" style="color: var(--severity-high)">${byStatus.acknowledged.length}</div>
            <div class="incident-stat-label">Acknowledged</div>
          </div>
          <div class="incident-stat">
            <div class="incident-stat-value" style="color: var(--accent-blue)">${byStatus['in-progress'].length}</div>
            <div class="incident-stat-label">In Progress</div>
          </div>
          <div class="incident-stat">
            <div class="incident-stat-value" style="color: var(--severity-low)">${byStatus.resolved.length}</div>
            <div class="incident-stat-label">Resolved</div>
          </div>
        </div>
        <button class="btn btn-danger" onclick="IncidentView.showReportModal()" id="btn-report-incident">
          ${Icons.plus} Report Incident
        </button>
      </div>

      <div class="kanban-board" id="kanban-board">
        ${this.renderColumn('reported', 'Reported', byStatus.reported)}
        ${this.renderColumn('acknowledged', 'Acknowledged', byStatus.acknowledged)}
        ${this.renderColumn('in-progress', 'In Progress', byStatus['in-progress'])}
        ${this.renderColumn('resolved', 'Resolved', byStatus.resolved)}
      </div>

      <!-- Incident Detail Panel -->
      <div class="incident-detail-overlay" id="incident-detail-overlay">
        <div class="incident-detail-backdrop" onclick="IncidentView.closeDetail()"></div>
        <div class="incident-detail-panel" id="incident-detail-panel"></div>
      </div>
    `;

    this.bindDragDrop();
    this.bindEvents();
  },

  renderColumn(status, label, incidents) {
    const colorMap = { reported: 'critical', acknowledged: 'high', 'in-progress': 'info', resolved: 'low' };
    return `
      <div class="kanban-column ${status}" data-status="${status}">
        <div class="kanban-column-header">
          <div class="kanban-column-title">
            <span class="status-dot ${status === 'reported' ? 'engaged' : status === 'acknowledged' ? 'responding' : status === 'in-progress' ? '' : 'available'}" style="${status === 'in-progress' ? 'background: var(--accent-blue); box-shadow: 0 0 6px var(--accent-blue);' : ''}"></span>
            ${label}
          </div>
          <div class="kanban-column-count">${incidents.length}</div>
        </div>
        <div class="kanban-cards" data-status="${status}">
          ${incidents.map(inc => this.renderCard(inc)).join('')}
        </div>
      </div>
    `;
  },

  renderCard(inc) {
    const typeInfo = INCIDENT_TYPES[inc.type] || { label: inc.type, color: '#64748b' };
    const iconKey = typeInfo.icon || 'alertCircle';
    const iconMap = { 'flame': Icons.flame, 'heart-pulse': Icons.heartPulse, 'shield-alert': Icons.shield, 'cloud-lightning': Icons.lightning, 'zap-off': Icons.zap, 'eye': Icons.eye, 'user-x': Icons.user };

    return `
      <div class="incident-card" draggable="true" data-id="${inc.id}" onclick="IncidentView.openDetail('${inc.id}')">
        <div class="incident-card-header">
          <div class="incident-card-id">${inc.id}</div>
          <span class="badge-severity ${inc.severity}">${inc.severity}</span>
        </div>
        <div class="incident-card-type" style="color: ${typeInfo.color}">
          ${iconMap[iconKey] || Icons.alertCircle}
          ${typeInfo.label}
        </div>
        <div class="incident-card-title">${inc.title}</div>
        <div class="incident-card-location">
          ${Icons.mapPin} ${inc.location}
        </div>
        <div class="incident-card-footer">
          <div class="incident-card-time">${Utils.formatRelative(inc.createdAt)}</div>
          <div class="incident-card-assignees">
            ${inc.assignees.slice(0, 3).map(a => `
              <div class="incident-card-avatar" style="background: ${a.color}">${a.initials}</div>
            `).join('')}
            ${inc.assignees.length > 3 ? `<div class="incident-card-avatar" style="background: var(--bg-hover)">+${inc.assignees.length - 3}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  openDetail(id) {
    const inc = Simulator.incidents.find(i => i.id === id);
    if (!inc) return;
    this.selectedIncident = inc;

    const panel = document.getElementById('incident-detail-panel');
    const typeInfo = INCIDENT_TYPES[inc.type] || { label: inc.type, color: '#64748b' };

    panel.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="flex items-center gap-md" style="margin-bottom: 8px;">
            <span class="text-mono text-tertiary text-sm">${inc.id}</span>
            <span class="badge-severity ${inc.severity}">${inc.severity}</span>
          </div>
          <h2 style="font-size: 1.2rem; font-weight: 700; line-height: 1.3;">${inc.title}</h2>
        </div>
        <button class="detail-close" onclick="IncidentView.closeDetail()">${Icons.x}</button>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Details</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="card" style="padding: 12px;">
            <div class="text-xs text-tertiary" style="margin-bottom: 4px;">Type</div>
            <div class="text-sm font-bold" style="color: ${typeInfo.color}">${typeInfo.label}</div>
          </div>
          <div class="card" style="padding: 12px;">
            <div class="text-xs text-tertiary" style="margin-bottom: 4px;">Location</div>
            <div class="text-sm font-bold">${inc.location}</div>
          </div>
          <div class="card" style="padding: 12px;">
            <div class="text-xs text-tertiary" style="margin-bottom: 4px;">Reported By</div>
            <div class="text-sm font-bold">${inc.reportedBy}</div>
          </div>
          <div class="card" style="padding: 12px;">
            <div class="text-xs text-tertiary" style="margin-bottom: 4px;">Status</div>
            <div class="text-sm font-bold" style="text-transform: capitalize">${inc.status}</div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Description</div>
        <p class="text-sm" style="color: var(--text-secondary); line-height: 1.6;">${inc.description}</p>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Assigned Personnel</div>
        <div class="personnel-grid">
          ${inc.assignees.length > 0 ? inc.assignees.map(a => `
            <div class="personnel-item">
              <div class="personnel-avatar" style="background: ${a.color}">${a.initials}</div>
              <div class="personnel-info">
                <div class="personnel-name">${a.name}</div>
                <div class="personnel-role">Responding</div>
              </div>
              <div class="status-dot responding"></div>
            </div>
          `).join('') : '<div class="text-sm text-tertiary" style="padding: 8px;">No personnel assigned</div>'}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Timeline</div>
        <div class="timeline">
          ${inc.timeline.map(t => `
            <div class="timeline-item">
              <div class="timeline-dot ${t.type}">
                ${t.type === 'critical' ? Icons.alertCircle : t.type === 'done' ? Icons.check : Icons.activity}
              </div>
              <div class="timeline-content">
                <div class="timeline-title">${t.action}</div>
                <div class="timeline-desc">${t.description}</div>
                <div class="timeline-time">${Utils.formatTime(t.time)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">AI Recommended Response</div>
        <div class="ai-recommendation" id="ai-recommendation">
          ${inc.aiDecision ? `<pre>${inc.aiDecision}</pre>` : '<div class="ai-loading">Loading recommendation...</div>'}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="IncidentView.refreshRecommendation()">Refresh Recommendation</button>
      </div>

      <div class="incident-actions">
        ${inc.status !== 'resolved' ? `
          ${inc.status === 'reported' ? `<button class="btn btn-primary btn-sm" onclick="IncidentView.moveIncident('${inc.id}', 'acknowledged')">Acknowledge</button>` : ''}
          ${inc.status === 'acknowledged' ? `<button class="btn btn-primary btn-sm" onclick="IncidentView.moveIncident('${inc.id}', 'in-progress')">Start Response</button>` : ''}
          ${inc.status === 'in-progress' ? `<button class="btn btn-success btn-sm" onclick="IncidentView.moveIncident('${inc.id}', 'resolved')">Mark Resolved</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="IncidentView.assignStaffModal('${inc.id}')">Assign Staff</button>
        ` : '<div class="text-sm" style="color: var(--severity-low);">✓ This incident has been resolved</div>'}
      </div>
    `;

    document.getElementById('incident-detail-overlay').classList.add('active');
    this.renderAIDecision(inc);
  },

  renderAIDecision(inc) {
    const container = document.getElementById('ai-recommendation');
    if (!container) return;

    container.innerHTML = inc.aiDecision ? `<pre>${inc.aiDecision}</pre>` : '<div class="ai-loading">Loading recommendation...</div>';

    if (!inc.aiDecision && typeof GeminiAI !== 'undefined') {
      GeminiAI.requestDecision(inc).then(() => {
        if (this.selectedIncident && this.selectedIncident.id === inc.id) {
          container.innerHTML = `<pre>${inc.aiDecision}</pre>`;
        }
      });
    }
  },

  refreshRecommendation() {
    if (!this.selectedIncident) return;
    const container = document.getElementById('ai-recommendation');
    if (container) container.innerHTML = '<div class="ai-loading">Refreshing recommendation...</div>';

    if (typeof GeminiAI !== 'undefined') {
      GeminiAI.requestDecision(this.selectedIncident).then(() => {
        if (container) container.innerHTML = `<pre>${this.selectedIncident.aiDecision}</pre>`;
      });
    }
  },

  closeDetail() {
    document.getElementById('incident-detail-overlay').classList.remove('active');
    this.selectedIncident = null;
  },

  moveIncident(id, newStatus) {
    Simulator.moveIncident(id, newStatus);
    this.closeDetail();
    this.render();
  },

  assignStaffModal(incidentId) {
    const available = Simulator.staff.filter(s => s.status === 'available');
    if (available.length === 0) {
      Toast.show('warning', 'No Available Staff', 'All staff are currently assigned or off-duty.');
      return;
    }

    const staff = available[0];
    Simulator.assignStaff(incidentId, staff.id);
    Toast.show('success', 'Staff Assigned', `${staff.name} assigned to incident.`);
    this.openDetail(incidentId);
  },

  showReportModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-content');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Report New Incident</h3>
        <button class="modal-close" onclick="App.closeModal()">${Icons.x}</button>
      </div>
      <form onsubmit="IncidentView.submitReport(event)">
        <div class="form-group">
          <label class="form-label">Incident Type</label>
          <select class="form-select" id="report-type" required>
            ${Object.entries(INCIDENT_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Severity</label>
          <select class="form-select" id="report-severity" required>
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Floor</label>
          <select class="form-select" id="report-floor" required onchange="IncidentView.updateRooms()">
            ${FLOORS.map(f => `<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Room / Area</label>
          <select class="form-select" id="report-room" required>
            ${ROOMS['Lobby'].map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="report-desc" rows="3" placeholder="Describe the incident..." required></textarea>
        </div>
        <div class="flex gap-sm" style="justify-content: flex-end; margin-top: 24px;">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-danger">Report Incident</button>
        </div>
      </form>
    `;

    overlay.classList.add('active');
  },

  updateRooms() {
    const floor = document.getElementById('report-floor').value;
    const roomSelect = document.getElementById('report-room');
    roomSelect.innerHTML = ROOMS[floor].map(r => `<option value="${r}">${r}</option>`).join('');
  },

  submitReport(e) {
    e.preventDefault();
    const type = document.getElementById('report-type').value;
    const severity = document.getElementById('report-severity').value;
    const floor = document.getElementById('report-floor').value;
    const room = document.getElementById('report-room').value;
    const desc = document.getElementById('report-desc').value;

    const incident = {
      id: Utils.generateId(),
      type,
      title: `${INCIDENT_TYPES[type].label} — ${floor}, ${room}`,
      severity,
      status: 'reported',
      location: `${floor} — ${room}`,
      floor,
      room,
      description: desc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignees: [],
      timeline: [{
        action: 'Incident Reported',
        description: 'Manually reported by operator',
        time: new Date().toISOString(),
        type: 'critical'
      }],
      reportedBy: 'Operator',
    };

    Simulator.incidents.push(incident);
    EventBus.emit('new-incident', incident);
    Toast.show('warning', 'Incident Reported', incident.title);

    if (typeof GeminiAI !== 'undefined') {
      GeminiAI.requestDecision(incident);
    }

    App.closeModal();
    this.render();
  },

  bindDragDrop() {
    const cards = document.querySelectorAll('.incident-card');
    const columns = document.querySelectorAll('.kanban-cards');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        columns.forEach(col => col.classList.remove('drag-over'));
      });
    });

    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.status;
        Simulator.moveIncident(id, newStatus);
        this.render();
      });
    });
  },

  bindEvents() {
    EventBus.on('new-incident', () => {
      if (document.getElementById('view-incidents').classList.contains('active')) {
        this.render();
      }
    });
  }
};
