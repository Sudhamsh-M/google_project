/* ============================================
   AEGIS — Data Simulator Engine
   ============================================ */

const Simulator = {
  staff: [],
  incidents: [],
  messages: [],
  channels: [],
  threatLevel: 'green',
  threatScore: 15,
  isRunning: false,
  autoGenerate: false,
  intervals: [],
  guestCount: 187,
  accountedGuests: 187,
  evacuationActive: false,
  lockdownActive: false,

  init() {
    this.generateStaff();
    this.generateInitialIncidents();
    this.generateChannels();
    this.generateInitialMessages();
    this.start();
  },

  start() {
    this.isRunning = true;
    if (this.autoGenerate) {
      // Generate new alerts every 8-15 seconds
      this.intervals.push(setInterval(() => this.generateRandomAlert(), Utils.random(8000, 15000)));
    }
    // Update staff positions every 5 seconds
    this.intervals.push(setInterval(() => this.updateStaffStatus(), 5000));
    // Update threat score every 10 seconds
    this.intervals.push(setInterval(() => this.updateThreatLevel(), 10000));
    // Add communication messages every 6-12 seconds
    this.intervals.push(setInterval(() => this.generateRandomMessage(), Utils.random(6000, 12000)));
  },

  stop() {
    this.isRunning = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  },

  toggleAutoGenerate() {
    this.autoGenerate = !this.autoGenerate;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    return this.autoGenerate;
  },

  triggerManualAlert() {
    if (this.isRunning) {
      this.generateRandomAlert();
    }
  },


  // --- Staff Generation ---
  generateStaff() {
    const firstNames = ['James', 'Maria', 'Robert', 'Sarah', 'Michael', 'Emily', 'David', 'Anna', 'Daniel', 'Lisa', 'Thomas', 'Jessica', 'Carlos', 'Rachel', 'Ahmed', 'Priya', 'Kevin', 'Nina', 'Marcus', 'Sophie', 'Alex', 'Olivia', 'Chen', 'Yuki'];
    const lastNames = ['Rodriguez', 'Chen', 'Williams', 'Patel', 'Kim', 'Anderson', 'Martinez', 'Taylor', 'Brown', 'Singh', 'Jones', 'Garcia', 'Miller', 'Davis', 'Lee', 'Wilson', 'Moore', 'Clark', 'Hall', 'Young', 'Wright', 'Scott', 'Adams', 'Nelson'];

    const roles = Object.keys(STAFF_ROLES);
    const statuses = ['available', 'available', 'available', 'responding', 'off-duty'];

    this.staff = [];
    for (let i = 0; i < 24; i++) {
      const firstName = Utils.pick(firstNames);
      const lastName = Utils.pick(lastNames);
      this.staff.push({
        id: `STAFF-${Utils.shortId()}`,
        name: `${firstName} ${lastName}`,
        initials: `${firstName[0]}${lastName[0]}`,
        role: roles[i % roles.length],
        status: Utils.pick(statuses),
        floor: Utils.pick(FLOORS),
        color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        checkedIn: Math.random() > 0.2,
        assignedIncident: null,
      });
    }
  },

  // --- Initial Incidents ---
  generateInitialIncidents() {
    const templates = [
      { type: 'fire', title: 'Smoke detected in kitchen exhaust', severity: 'high', floor: 'Lobby', room: 'Restaurant', status: 'in-progress' },
      { type: 'medical', title: 'Guest collapsed in pool area', severity: 'critical', floor: 'Lobby', room: 'Pool Area', status: 'acknowledged' },
      { type: 'security', title: 'Unauthorized access attempt - Staff entrance', severity: 'medium', floor: 'Lobby', room: 'Parking Garage', status: 'in-progress' },
      { type: 'suspicious', title: 'Unattended luggage near conference hall', severity: 'high', floor: 'Lobby', room: 'Conference Hall A', status: 'reported' },
      { type: 'utility', title: 'Elevator #3 stuck between floors', severity: 'medium', floor: 'Floor 3', room: '305', status: 'acknowledged' },
      { type: 'distress', title: 'Guest reported threatening phone call', severity: 'low', floor: 'Floor 2', room: '208', status: 'resolved' },
    ];

    this.incidents = templates.map((t, i) => {
      const created = new Date(Date.now() - Utils.random(300000, 3600000));
      const assignees = Utils.shuffle(this.staff.filter(s => s.status !== 'off-duty')).slice(0, Utils.random(1, 3));

      assignees.forEach(a => {
        if (t.status !== 'resolved') {
          a.status = 'responding';
          a.assignedIncident = `INC-${i}`;
        }
      });

      return {
        id: `INC-${String(1000 + i).slice(1)}`,
        ...t,
        description: this.getIncidentDescription(t.type),
        location: `${t.floor} — ${t.room}`,
        createdAt: created.toISOString(),
        updatedAt: new Date(created.getTime() + Utils.random(60000, 300000)).toISOString(),
        assignees: assignees.map(a => ({ id: a.id, name: a.name, initials: a.initials, color: a.color })),
        timeline: this.generateTimeline(t.status, created),
        reportedBy: Utils.pick(['Guest', 'Staff', 'Sensor', 'Camera', 'Automated System']),
      };
    });
  },

  getIncidentDescription(type) {
    const descs = {
      fire: 'Smoke detection system triggered. Kitchen staff reported visible smoke from exhaust vent. No visible flames. Fire suppression system on standby.',
      medical: 'Adult male, approximately 55 years old, found unresponsive near the deep end. Lifeguard initiated CPR. AED deployed. Paramedics dispatched.',
      security: 'Badge reader triggered unauthorized access alert. Security camera shows individual attempting entry with expired credentials. Perimeter secured.',
      suspicious: 'Unattended black duffle bag found near east entrance of Conference Hall A. Area cordoned off. Bomb squad protocol initiated per SOP.',
      utility: 'Elevator car stuck between floors 3 and 4. Two guests inside, reporting no injuries. Emergency intercom operational. Maintenance team dispatched.',
      distress: 'Guest in room 208 reported receiving threatening phone call. Visibly distressed. Requesting security escort and room change.',
      natural: 'Severe weather advisory issued. High winds expected. Outdoor areas secured. Guests advised to remain indoors.',
    };
    return descs[type] || 'Incident details pending investigation.';
  },

  generateTimeline(status, created) {
    const timeline = [];
    timeline.push({
      action: 'Incident Reported',
      description: 'Alert received and logged in system',
      time: created.toISOString(),
      type: 'critical'
    });

    if (['acknowledged', 'in-progress', 'resolved'].includes(status)) {
      timeline.push({
        action: 'Acknowledged',
        description: 'Response team notified and dispatched',
        time: new Date(created.getTime() + Utils.random(30000, 120000)).toISOString(),
        type: 'active'
      });
    }

    if (['in-progress', 'resolved'].includes(status)) {
      timeline.push({
        action: 'Response In Progress',
        description: 'Personnel on scene, situation being assessed',
        time: new Date(created.getTime() + Utils.random(120000, 300000)).toISOString(),
        type: 'active'
      });
    }

    if (status === 'resolved') {
      timeline.push({
        action: 'Resolved',
        description: 'Situation contained and resolved. All-clear given.',
        time: new Date(created.getTime() + Utils.random(300000, 600000)).toISOString(),
        type: 'done'
      });
    }

    return timeline;
  },

  // --- Channels ---
  generateChannels() {
    this.channels = [
      { id: 'ch-emergency', name: 'Emergency Main', type: 'emergency', unread: 3, lastMessage: 'All units: Code Red activated for Pool Area', lastTime: new Date().toISOString() },
      { id: 'ch-inc-001', name: 'INC-001 Kitchen Fire', type: 'incident', unread: 1, lastMessage: 'Exhaust fan isolated. Smoke clearing.', lastTime: new Date(Date.now() - 120000).toISOString() },
      { id: 'ch-inc-002', name: 'INC-002 Medical Emergency', type: 'incident', unread: 5, lastMessage: 'Paramedics ETA 3 minutes', lastTime: new Date(Date.now() - 60000).toISOString() },
      { id: 'ch-security', name: 'Security Team', type: 'team', unread: 0, lastMessage: 'Perimeter checks completed', lastTime: new Date(Date.now() - 300000).toISOString() },
      { id: 'ch-management', name: 'Management', type: 'team', unread: 2, lastMessage: 'Guest relations briefing at 1600', lastTime: new Date(Date.now() - 180000).toISOString() },
      { id: 'ch-general', name: 'General Updates', type: 'general', unread: 0, lastMessage: 'Shift change at 1800 confirmed', lastTime: new Date(Date.now() - 600000).toISOString() },
    ];
  },

  // --- Messages ---
  generateInitialMessages() {
    this.messages = {
      'ch-emergency': [
        { id: 'm1', sender: 'AEGIS System', role: 'System', initials: 'SY', color: '#3b82f6', text: 'Emergency channel activated. All personnel are advised to monitor for updates.', time: new Date(Date.now() - 3600000).toISOString(), priority: 'routine' },
        { id: 'm2', sender: 'Maria Rodriguez', role: 'Security Lead', initials: 'MR', color: '#ef4444', text: 'Smoke detected in kitchen area. Dispatching Team Alpha to investigate. Kitchen staff, initiate fire protocol.', time: new Date(Date.now() - 1800000).toISOString(), priority: 'urgent' },
        { id: 'm3', sender: 'Daniel Singh', role: 'Medical Lead', initials: 'DS', color: '#f97316', text: 'Medical emergency at Pool Area. Guest unresponsive. CPR initiated. Requesting paramedic dispatch immediately.', time: new Date(Date.now() - 600000).toISOString(), priority: 'critical' },
        { id: 'm4', sender: 'AEGIS System', role: 'System', initials: 'SY', color: '#3b82f6', text: 'All units: Code Red activated for Pool Area. Medical team en route. Security to establish perimeter.', time: new Date(Date.now() - 300000).toISOString(), priority: 'flash' },
        { id: 'm5', sender: 'Robert Taylor', role: 'Front Desk', initials: 'RT', color: '#06b6d4', text: 'Confirmed: Paramedics dispatched. ETA 4 minutes. Lobby entrance cleared for emergency vehicle access.', time: new Date(Date.now() - 180000).toISOString(), priority: 'urgent' },
      ],
      'ch-inc-001': [
        { id: 'm6', sender: 'AEGIS System', role: 'System', initials: 'SY', color: '#3b82f6', text: 'Incident INC-001 channel created: Kitchen fire alarm triggered.', time: new Date(Date.now() - 1800000).toISOString(), priority: 'routine' },
        { id: 'm7', sender: 'Kevin Clark', role: 'Engineering', initials: 'KC', color: '#8b5cf6', text: 'Exhaust fan system isolated. Smoke appears to be from burned food product, not structural fire. Continuing investigation.', time: new Date(Date.now() - 900000).toISOString(), priority: 'routine' },
        { id: 'm8', sender: 'Maria Rodriguez', role: 'Security Lead', initials: 'MR', color: '#ef4444', text: 'Fire department notified as precaution. Keeping restaurant guests calm. No evacuation needed at this time.', time: new Date(Date.now() - 600000).toISOString(), priority: 'routine' },
      ],
      'ch-inc-002': [
        { id: 'm9', sender: 'AEGIS System', role: 'System', initials: 'SY', color: '#3b82f6', text: 'Incident INC-002 channel created: Medical emergency at Pool Area.', time: new Date(Date.now() - 600000).toISOString(), priority: 'routine' },
        { id: 'm10', sender: 'Daniel Singh', role: 'Medical Lead', initials: 'DS', color: '#f97316', text: 'Patient has pulse but unconscious. AED shows normal sinus. Maintaining recovery position. Need stretcher at pool deck.', time: new Date(Date.now() - 420000).toISOString(), priority: 'critical' },
        { id: 'm11', sender: 'Sarah Patel', role: 'Lifeguard', initials: 'SP', color: '#22c55e', text: 'Pool area cleared of other guests. Towels and blankets provided. Witness states guest was swimming laps before collapse.', time: new Date(Date.now() - 300000).toISOString(), priority: 'routine' },
      ],
    };

    // Fill other channels with empty arrays
    this.channels.forEach(ch => {
      if (!this.messages[ch.id]) this.messages[ch.id] = [];
    });
  },

  // --- Random Alert Generation ---
  generateRandomAlert() {
    if (!this.isRunning) return;

    const alertTypes = [
      { type: 'security', titles: ['Motion detected in restricted area', 'Unauthorized door access attempt', 'CCTV anomaly detected - East wing', 'Perimeter sensor triggered'], severity: 'medium' },
      { type: 'fire', titles: ['Smoke detector activated - Floor {floor}', 'Heat sensor alert - Room {room}', 'Fire door propped open - Floor {floor}'], severity: 'high' },
      { type: 'medical', titles: ['Guest requesting medical assistance - Room {room}', 'Staff injury reported - {area}', 'AED deployed - Floor {floor}'], severity: 'high' },
      { type: 'utility', titles: ['HVAC anomaly - Floor {floor}', 'Water pressure drop - Floor {floor}', 'Power fluctuation detected', 'Generator test failed'], severity: 'low' },
      { type: 'suspicious', titles: ['Guest behavior flagged by staff', 'Unusual luggage scan result', 'Vehicle circling parking area'], severity: 'medium' },
    ];

    const alert = Utils.pick(alertTypes);
    const floor = Utils.pick(FLOORS);
    const room = Utils.pick(ROOMS[floor]);

    let title = Utils.pick(alert.titles)
      .replace('{floor}', floor)
      .replace('{room}', room)
      .replace('{area}', Utils.pick(['Kitchen', 'Laundry', 'Maintenance Room', 'Loading Dock']));

    const newAlert = {
      id: Utils.generateId(),
      type: alert.type,
      title: title,
      severity: alert.severity,
      location: `${floor} — ${room}`,
      time: new Date().toISOString(),
      description: this.getIncidentDescription(alert.type),
    };

    EventBus.emit('new-alert', newAlert);

    // 30% chance of also creating an incident
    if (Math.random() < 0.3) {
      this.createIncidentFromAlert(newAlert);
    }
  },

  createIncidentFromAlert(alert) {
    const incident = {
      id: Utils.generateId(),
      type: alert.type,
      title: alert.title,
      severity: alert.severity,
      status: 'reported',
      location: alert.location,
      floor: alert.location.split(' — ')[0],
      room: alert.location.split(' — ')[1],
      description: alert.description,
      createdAt: alert.time,
      updatedAt: alert.time,
      assignees: [],
      timeline: [{
        action: 'Incident Reported',
        description: 'Auto-generated from sensor alert',
        time: alert.time,
        type: 'critical'
      }],
      reportedBy: 'Automated System',
    };

    this.incidents.push(incident);
    EventBus.emit('new-incident', incident);
    Toast.show('warning', 'New Incident', `${alert.title} — ${alert.location}`);

    if (typeof GeminiAI !== 'undefined') {
      GeminiAI.requestDecision(incident);
    }
  },

  // --- Staff Status Updates ---
  updateStaffStatus() {
    if (!this.isRunning) return;

    const staff = Utils.pick(this.staff.filter(s => s.status !== 'off-duty'));
    if (!staff) return;

    const transitions = {
      'available': ['responding', 'available'],
      'responding': ['engaged', 'available'],
      'engaged': ['available', 'responding'],
    };

    const newStatus = Utils.pick(transitions[staff.status] || ['available']);
    if (newStatus !== staff.status) {
      staff.status = newStatus;
      staff.floor = Utils.pick(FLOORS);
      EventBus.emit('staff-update', staff);
    }
  },

  // --- Threat Level ---
  updateThreatLevel() {
    const activeIncidents = this.incidents.filter(i => i.status !== 'resolved');
    const criticalCount = activeIncidents.filter(i => i.severity === 'critical').length;
    const highCount = activeIncidents.filter(i => i.severity === 'high').length;

    let score = criticalCount * 30 + highCount * 15 + activeIncidents.length * 5;
    score = Math.min(100, Math.max(5, score + Utils.random(-5, 5)));

    this.threatScore = score;

    let newLevel = 'green';
    if (score >= 70) newLevel = 'red';
    else if (score >= 40) newLevel = 'amber';

    if (newLevel !== this.threatLevel) {
      this.threatLevel = newLevel;
      EventBus.emit('threat-change', { level: newLevel, score });
    }

    EventBus.emit('threat-update', { level: this.threatLevel, score: this.threatScore });
  },

  // --- Random Messages ---
  generateRandomMessage() {
    if (!this.isRunning) return;

    const channel = Utils.pick(this.channels);
    const staff = Utils.pick(this.staff.filter(s => s.status !== 'off-duty'));
    if (!staff) return;

    const messages = [
      'Copy that. Moving to position.',
      'Area clear, proceeding to next checkpoint.',
      'Guest has been escorted to safety. Returning to post.',
      'Confirming all exits are secured on this floor.',
      'Surveillance shows no further activity. Maintaining watch.',
      'Need backup at the east stairwell.',
      'Status update: situation stable, monitoring.',
      'Emergency supplies replenished at station 3.',
      'Shift handover complete. All systems nominal.',
      'Guest count for this floor: all accounted for.',
      'Fire panel shows all green. False alarm confirmed.',
      'Engineering team has restored power to wing B.',
      'Requesting additional medical supplies at station 1.',
    ];

    const msg = {
      id: `m-${Utils.shortId()}`,
      sender: staff.name,
      role: STAFF_ROLES[staff.role].label,
      initials: staff.initials,
      color: staff.color,
      text: Utils.pick(messages),
      time: new Date().toISOString(),
      priority: Utils.pick(['routine', 'routine', 'routine', 'urgent']),
    };

    if (!this.messages[channel.id]) this.messages[channel.id] = [];
    this.messages[channel.id].push(msg);
    channel.lastMessage = msg.text;
    channel.lastTime = msg.time;

    EventBus.emit('new-message', { channelId: channel.id, message: msg });
  },

  // --- Actions ---
  triggerLockdown() {
    this.lockdownActive = true;
    this.threatScore = Math.min(100, this.threatScore + 30);
    this.threatLevel = 'red';
    Toast.show('critical', 'LOCKDOWN ACTIVATED', 'All access points sealed. Guests advised to shelter in place.');
    EventBus.emit('lockdown', true);
    EventBus.emit('threat-update', { level: 'red', score: this.threatScore });
  },

  triggerEvacuation() {
    this.evacuationActive = true;
    this.accountedGuests = Math.floor(this.guestCount * 0.6);
    this.threatScore = Math.min(100, this.threatScore + 20);
    Toast.show('warning', 'EVACUATION INITIATED', 'All personnel: begin evacuation procedures. Direct guests to nearest exits.');
    EventBus.emit('evacuation', true);

    // Simulate guest accounting
    const interval = setInterval(() => {
      if (this.accountedGuests >= this.guestCount) {
        clearInterval(interval);
        Toast.show('success', 'Evacuation Complete', 'All guests accounted for.');
        return;
      }
      this.accountedGuests = Math.min(this.guestCount, this.accountedGuests + Utils.random(3, 8));
      EventBus.emit('evacuation-update', { accounted: this.accountedGuests, total: this.guestCount });
    }, 2000);
  },

  triggerAllClear() {
    this.lockdownActive = false;
    this.evacuationActive = false;
    this.threatScore = Math.max(10, this.threatScore - 40);
    this.threatLevel = this.threatScore >= 40 ? 'amber' : 'green';
    this.accountedGuests = this.guestCount;
    Toast.show('success', 'ALL CLEAR', 'Threat level normalized. Resume normal operations.');
    EventBus.emit('all-clear', true);
    EventBus.emit('threat-update', { level: this.threatLevel, score: this.threatScore });
  },

  requestBackup() {
    Toast.show('info', 'BACKUP REQUESTED', 'Additional units dispatched. ETA: 8 minutes.');
    EventBus.emit('backup-requested', true);
  },

  // --- Incident Management ---
  moveIncident(incidentId, newStatus) {
    const inc = this.incidents.find(i => i.id === incidentId);
    if (!inc) return;

    inc.status = newStatus;
    inc.updatedAt = new Date().toISOString();
    inc.timeline.push({
      action: newStatus === 'acknowledged' ? 'Acknowledged' : newStatus === 'in-progress' ? 'Response In Progress' : 'Resolved',
      description: `Status updated to ${newStatus}`,
      time: inc.updatedAt,
      type: newStatus === 'resolved' ? 'done' : 'active'
    });

    EventBus.emit('incident-update', inc);
  },

  assignStaff(incidentId, staffId) {
    const inc = this.incidents.find(i => i.id === incidentId);
    const staff = this.staff.find(s => s.id === staffId);
    if (!inc || !staff) return;

    staff.status = 'responding';
    staff.assignedIncident = incidentId;
    inc.assignees.push({ id: staff.id, name: staff.name, initials: staff.initials, color: staff.color });

    EventBus.emit('incident-update', inc);
    EventBus.emit('staff-update', staff);
  }
};
