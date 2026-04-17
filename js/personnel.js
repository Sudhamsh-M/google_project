/* ============================================
   AEGIS — Personnel Tracker View
   ============================================ */

const PersonnelView = {
  filterRole: 'all',
  filterStatus: 'all',

  render() {
    const container = document.getElementById('view-personnel');
    const staff = this.getFilteredStaff();
    const statusCounts = {
      available: Simulator.staff.filter(s => s.status === 'available').length,
      responding: Simulator.staff.filter(s => s.status === 'responding').length,
      engaged: Simulator.staff.filter(s => s.status === 'engaged').length,
      'off-duty': Simulator.staff.filter(s => s.status === 'off-duty').length,
    };

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; height: calc(100vh - 130px);">
        <!-- Header Stats -->
        <div style="display: flex; gap: 12px; flex-shrink: 0;">
          <div class="metric-card green" style="flex: 1; padding: 16px;">
            <div class="flex items-center gap-sm" style="margin-bottom: 4px;">
              <div class="status-dot available"></div>
              <span class="text-xs text-tertiary" style="text-transform: uppercase; letter-spacing: 0.5px;">Available</span>
            </div>
            <div class="metric-value" style="font-size: 1.8rem;">${statusCounts.available}</div>
          </div>
          <div class="metric-card amber" style="flex: 1; padding: 16px;">
            <div class="flex items-center gap-sm" style="margin-bottom: 4px;">
              <div class="status-dot responding"></div>
              <span class="text-xs text-tertiary" style="text-transform: uppercase; letter-spacing: 0.5px;">Responding</span>
            </div>
            <div class="metric-value" style="font-size: 1.8rem;">${statusCounts.responding}</div>
          </div>
          <div class="metric-card red" style="flex: 1; padding: 16px;">
            <div class="flex items-center gap-sm" style="margin-bottom: 4px;">
              <div class="status-dot engaged"></div>
              <span class="text-xs text-tertiary" style="text-transform: uppercase; letter-spacing: 0.5px;">Engaged</span>
            </div>
            <div class="metric-value" style="font-size: 1.8rem;">${statusCounts.engaged}</div>
          </div>
          <div class="metric-card blue" style="flex: 1; padding: 16px;">
            <div class="flex items-center gap-sm" style="margin-bottom: 4px;">
              <div class="status-dot offline"></div>
              <span class="text-xs text-tertiary" style="text-transform: uppercase; letter-spacing: 0.5px;">Off Duty</span>
            </div>
            <div class="metric-value" style="font-size: 1.8rem;">${statusCounts['off-duty']}</div>
          </div>
        </div>

        <!-- Filters + Emergency Check-in -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div class="flex gap-sm">
            <select class="form-select" style="width: auto; font-size: 0.78rem;" onchange="PersonnelView.setRoleFilter(this.value)" id="filter-role">
              <option value="all">All Roles</option>
              ${Object.entries(STAFF_ROLES).map(([k, v]) => `<option value="${k}" ${this.filterRole === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
            <select class="form-select" style="width: auto; font-size: 0.78rem;" onchange="PersonnelView.setStatusFilter(this.value)" id="filter-status">
              <option value="all">All Status</option>
              ${Object.entries(STAFF_STATUSES).map(([k, v]) => `<option value="${k}" ${this.filterStatus === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="PersonnelView.emergencyCheckIn()" id="btn-checkin">
            ${Icons.check} Emergency Roll Call
          </button>
        </div>

        <!-- Staff Grid -->
        <div style="flex: 1; overflow-y: auto;">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;" class="stagger-children" id="staff-grid">
            ${staff.map(s => this.renderStaffCard(s)).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderStaffCard(s) {
    const roleInfo = STAFF_ROLES[s.role] || { label: s.role, color: '#64748b' };
    const statusInfo = STAFF_STATUSES[s.status] || STAFF_STATUSES['off-duty'];
    const assignedInc = s.assignedIncident ? Simulator.incidents.find(i => i.id === s.assignedIncident) : null;

    return `
      <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.borderColor='var(--border-medium)'" onmouseleave="this.style.borderColor='var(--border-subtle)'">
        <div style="position: relative; flex-shrink: 0;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: ${s.color}; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: white;">
            ${s.initials}
          </div>
          <div class="status-dot ${s.status}" style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border: 2px solid var(--bg-secondary);"></div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
            <span style="font-weight: 600; font-size: 0.88rem;">${s.name}</span>
            ${s.checkedIn ? `<span style="font-size: 0.6rem; color: var(--severity-low);">✓</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.72rem; color: ${roleInfo.color}; font-weight: 600;">${roleInfo.label}</span>
            <span style="font-size: 0.65rem; color: var(--text-tertiary);">•</span>
            <span style="font-size: 0.72rem; color: var(--text-tertiary);">${s.floor}</span>
          </div>
          ${assignedInc ? `
            <div style="margin-top: 6px; font-size: 0.68rem; color: var(--severity-high); display: flex; align-items: center; gap: 4px;">
              ${Icons.activity} Assigned: ${assignedInc.title.substring(0, 30)}...
            </div>
          ` : ''}
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div class="badge-severity ${s.status === 'available' ? 'low' : s.status === 'responding' ? 'high' : s.status === 'engaged' ? 'critical' : 'info'}" style="font-size: 0.6rem;">
            ${statusInfo.label}
          </div>
          <span class="text-mono text-xs text-tertiary">${s.id}</span>
        </div>
      </div>
    `;
  },

  getFilteredStaff() {
    return Simulator.staff.filter(s => {
      if (this.filterRole !== 'all' && s.role !== this.filterRole) return false;
      if (this.filterStatus !== 'all' && s.status !== this.filterStatus) return false;
      return true;
    });
  },

  setRoleFilter(role) {
    this.filterRole = role;
    this.updateGrid();
  },

  setStatusFilter(status) {
    this.filterStatus = status;
    this.updateGrid();
  },

  updateGrid() {
    const grid = document.getElementById('staff-grid');
    if (grid) {
      grid.innerHTML = this.getFilteredStaff().map(s => this.renderStaffCard(s)).join('');
    }
  },

  emergencyCheckIn() {
    let checked = 0;
    const onDuty = Simulator.staff.filter(s => s.status !== 'off-duty');

    Toast.show('info', 'Roll Call Initiated', `Checking in ${onDuty.length} on-duty staff...`);

    const interval = setInterval(() => {
      if (checked >= onDuty.length) {
        clearInterval(interval);
        Toast.show('success', 'Roll Call Complete', `${onDuty.length}/${onDuty.length} staff accounted for.`);
        return;
      }
      onDuty[checked].checkedIn = true;
      checked++;
      this.updateGrid();
    }, 300);
  },

  bindEvents() {
    EventBus.on('staff-update', () => {
      if (document.getElementById('view-personnel').classList.contains('active')) {
        this.updateGrid();
      }
    });
  }
};
