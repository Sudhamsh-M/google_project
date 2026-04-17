/* ============================================
   AEGIS — Venue Map View
   ============================================ */

const MapView = {
  activeFloor: 'Lobby',
  hazardZones: [],
  evacuationRoutes: false,

  render() {
    const container = document.getElementById('view-map');
    const floorStaff = Simulator.staff.filter(s => s.floor === this.activeFloor && s.status !== 'off-duty');
    const floorIncidents = Simulator.incidents.filter(i => i.floor === this.activeFloor && i.status !== 'resolved');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 280px; gap: 16px; height: calc(100vh - 130px);">
        <!-- Map Area -->
        <div class="card" style="display: flex; flex-direction: column; overflow: hidden;">
          <!-- Floor Selector -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 16px; flex-shrink: 0;">
            <div class="flex gap-sm">
              ${FLOORS.map(f => `
                <button class="btn btn-sm ${f === this.activeFloor ? 'btn-primary' : 'btn-ghost'}" onclick="MapView.switchFloor('${f}')">${f}</button>
              `).join('')}
            </div>
            <div class="flex gap-sm">
              <button class="btn btn-sm ${this.evacuationRoutes ? 'btn-warning' : 'btn-ghost'}" onclick="MapView.toggleEvacRoutes()" id="btn-evac-routes">
                ${Icons.logOut} Routes
              </button>
              <button class="btn btn-sm btn-ghost" onclick="MapView.markHazard()">
                ${Icons.incidents} Mark Hazard
              </button>
            </div>
          </div>

          <!-- SVG Floor Plan -->
          <div style="flex: 1; position: relative; overflow: hidden; background: var(--bg-tertiary); border-radius: var(--radius-md);" id="map-container">
            <svg viewBox="0 0 800 500" id="floor-svg" style="width: 100%; height: 100%;">
              ${this.renderFloorPlan()}
            </svg>
          </div>

          <!-- Map Legend -->
          <div style="display: flex; gap: 20px; padding-top: 12px; flex-shrink: 0; border-top: 1px solid var(--border-subtle); margin-top: 12px;">
            <div class="flex items-center gap-sm text-xs text-tertiary">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--status-available);"></div> Available Staff
            </div>
            <div class="flex items-center gap-sm text-xs text-tertiary">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--status-responding);"></div> Responding
            </div>
            <div class="flex items-center gap-sm text-xs text-tertiary">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--severity-critical);"></div> Incident
            </div>
            <div class="flex items-center gap-sm text-xs text-tertiary">
              <div style="width: 12px; height: 12px; border: 2px solid var(--severity-low); border-radius: 2px;"></div> Exit
            </div>
            ${this.evacuationRoutes ? `
              <div class="flex items-center gap-sm text-xs text-tertiary">
                <div style="width: 16px; height: 3px; background: var(--severity-low);"></div> Evacuation Route
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Side Panel -->
        <div style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
          <!-- Floor Info -->
          <div class="card" style="padding: 16px;">
            <div class="card-title" style="margin-bottom: 12px;">Floor Overview</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-blue);">${floorStaff.length}</div>
                <div class="text-xs text-tertiary">Staff</div>
              </div>
              <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: ${floorIncidents.length > 0 ? 'var(--severity-critical)' : 'var(--severity-low)'};">${floorIncidents.length}</div>
                <div class="text-xs text-tertiary">Incidents</div>
              </div>
              <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--severity-low);">${ROOMS[this.activeFloor].length}</div>
                <div class="text-xs text-tertiary">Rooms</div>
              </div>
              <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-secondary);">${this.activeFloor === 'Lobby' ? '4' : '2'}</div>
                <div class="text-xs text-tertiary">Exits</div>
              </div>
            </div>
          </div>

          <!-- Guest Safety -->
          <div class="card" style="padding: 16px;">
            <div class="card-title" style="margin-bottom: 12px;">Guest Safety</div>
            <div style="margin-bottom: 12px;">
              <div class="flex justify-between text-xs" style="margin-bottom: 6px;">
                <span class="text-tertiary">Accounted For</span>
                <span class="font-bold" style="color: var(--severity-low);">${Simulator.accountedGuests}/${Simulator.guestCount}</span>
              </div>
              <div class="metric-bar-track">
                <div class="metric-bar-fill green" style="width: ${(Simulator.accountedGuests / Simulator.guestCount * 100)}%"></div>
              </div>
            </div>
            ${Simulator.evacuationActive ? `
              <div style="padding: 8px; background: var(--severity-high-dim); border: 1px solid rgba(249, 115, 22, 0.2); border-radius: var(--radius-sm); margin-top: 8px;">
                <div class="text-xs font-bold" style="color: var(--severity-high); margin-bottom: 2px;">⚠ EVACUATION ACTIVE</div>
                <div class="text-xs text-secondary">Guests being directed to assembly points</div>
              </div>
            ` : ''}
            ${Simulator.lockdownActive ? `
              <div style="padding: 8px; background: var(--severity-critical-dim); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-sm); margin-top: 8px;">
                <div class="text-xs font-bold" style="color: var(--severity-critical); margin-bottom: 2px;">🔒 LOCKDOWN ACTIVE</div>
                <div class="text-xs text-secondary">All access points sealed</div>
              </div>
            ` : ''}
          </div>

          <!-- Active Incidents on Floor -->
          <div class="card" style="padding: 16px; flex: 1;">
            <div class="card-title" style="margin-bottom: 12px;">Floor Incidents</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${floorIncidents.length > 0 ? floorIncidents.map(inc => `
                <div style="padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border-left: 3px solid ${SEVERITY_LEVELS[inc.severity].color}; cursor: pointer;" onclick="App.navigate('incidents')">
                  <div class="text-sm font-bold" style="margin-bottom: 2px;">${inc.title.substring(0, 35)}${inc.title.length > 35 ? '...' : ''}</div>
                  <div class="flex items-center gap-sm">
                    <span class="badge-severity ${inc.severity}" style="font-size: 0.58rem;">${inc.severity}</span>
                    <span class="text-xs text-tertiary">${inc.room || ''}</span>
                  </div>
                </div>
              `).join('') : '<div class="text-sm text-tertiary" style="text-align: center; padding: 20px;">No active incidents</div>'}
            </div>
          </div>

          <!-- Staff on Floor -->
          <div class="card" style="padding: 16px;">
            <div class="card-title" style="margin-bottom: 12px;">Staff on Floor</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${floorStaff.slice(0, 6).map(s => `
                <div class="flex items-center gap-sm" style="padding: 6px 0;">
                  <div style="width: 26px; height: 26px; border-radius: 50%; background: ${s.color}; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; color: white;">${s.initials}</div>
                  <div style="flex: 1;">
                    <div class="text-xs font-bold">${s.name.split(' ')[0]} ${s.name.split(' ')[1][0]}.</div>
                    <div style="font-size: 0.6rem; color: var(--text-tertiary);">${STAFF_ROLES[s.role].label}</div>
                  </div>
                  <div class="status-dot ${s.status}"></div>
                </div>
              `).join('')}
              ${floorStaff.length > 6 ? `<div class="text-xs text-tertiary text-center">+${floorStaff.length - 6} more</div>` : ''}
              ${floorStaff.length === 0 ? '<div class="text-xs text-tertiary text-center" style="padding: 10px;">No staff on this floor</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderFloorPlan() {
    const rooms = ROOMS[this.activeFloor];
    const isLobby = this.activeFloor === 'Lobby';
    let svg = '';

    // Background grid
    for (let x = 0; x < 800; x += 40) {
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="rgba(148,163,184,0.05)" stroke-width="0.5"/>`;
    }
    for (let y = 0; y < 500; y += 40) {
      svg += `<line x1="0" y1="${y}" x2="800" y2="${y}" stroke="rgba(148,163,184,0.05)" stroke-width="0.5"/>`;
    }

    // Building outline
    svg += `<rect x="30" y="30" width="740" height="440" rx="8" fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="2"/>`;

    // Corridor
    if (isLobby) {
      svg += `<rect x="30" y="200" width="740" height="100" fill="rgba(59,130,246,0.03)" stroke="rgba(59,130,246,0.1)" stroke-width="1" stroke-dasharray="4"/>`;
      svg += `<text x="400" y="255" text-anchor="middle" fill="rgba(148,163,184,0.3)" font-size="12" font-family="Inter">MAIN CORRIDOR</text>`;
    } else {
      svg += `<rect x="30" y="220" width="740" height="60" fill="rgba(59,130,246,0.03)" stroke="rgba(59,130,246,0.1)" stroke-width="1" stroke-dasharray="4"/>`;
      svg += `<text x="400" y="255" text-anchor="middle" fill="rgba(148,163,184,0.3)" font-size="11" font-family="Inter">HALLWAY</text>`;
    }

    // Rooms
    if (isLobby) {
      const lobbyRooms = [
        { name: 'Reception', x: 50, y: 50, w: 160, h: 130 },
        { name: 'Restaurant', x: 230, y: 50, w: 180, h: 130 },
        { name: 'Bar', x: 430, y: 50, w: 120, h: 130 },
        { name: 'Spa', x: 570, y: 50, w: 180, h: 130 },
        { name: 'Pool Area', x: 50, y: 320, w: 200, h: 130 },
        { name: 'Parking Garage', x: 270, y: 320, w: 160, h: 130 },
        { name: 'Conf. Hall A', x: 450, y: 320, w: 150, h: 130 },
        { name: 'Conf. Hall B', x: 620, y: 320, w: 130, h: 130 },
      ];

      lobbyRooms.forEach(r => {
        const hasIncident = Simulator.incidents.some(i => i.room === r.name && i.floor === 'Lobby' && i.status !== 'resolved');
        const fillColor = hasIncident ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.04)';
        const strokeColor = hasIncident ? 'rgba(239,68,68,0.4)' : 'rgba(148,163,184,0.12)';

        svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" class="map-room"/>`;
        svg += `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 4}" text-anchor="middle" fill="rgba(241,245,249,0.6)" font-size="11" font-family="Inter" font-weight="600">${r.name}</text>`;

        if (hasIncident) {
          svg += `<circle cx="${r.x + r.w - 12}" cy="${r.y + 12}" r="5" fill="#ef4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>`;
        }
      });
    } else {
      // Regular floor rooms
      const cols = 5;
      const rows = 2;
      const roomW = 128;
      const roomH = 75;
      const startX = 55;
      const startYTop = 50;
      const startYBot = 300;
      const gap = 12;

      rooms.forEach((room, i) => {
        const col = i % cols;
        const isTop = i < cols;
        const x = startX + col * (roomW + gap);
        const y = isTop ? startYTop : startYBot;

        const hasIncident = Simulator.incidents.some(inc => inc.room === room && inc.floor === this.activeFloor && inc.status !== 'resolved');
        const fillColor = hasIncident ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.04)';
        const strokeColor = hasIncident ? 'rgba(239,68,68,0.4)' : 'rgba(148,163,184,0.12)';

        svg += `<rect x="${x}" y="${y}" width="${roomW}" height="${roomH}" rx="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>`;

        // Room door
        const doorY = isTop ? y + roomH : y;
        svg += `<rect x="${x + roomW / 2 - 8}" y="${doorY - 2}" width="16" height="4" rx="2" fill="rgba(148,163,184,0.2)"/>`;

        svg += `<text x="${x + roomW / 2}" y="${y + roomH / 2 + 4}" text-anchor="middle" fill="rgba(241,245,249,0.6)" font-size="14" font-family="JetBrains Mono" font-weight="600">${room}</text>`;

        if (hasIncident) {
          svg += `<circle cx="${x + roomW - 10}" cy="${y + 10}" r="5" fill="#ef4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>`;
        }
      });
    }

    // Exits
    const exits = isLobby
      ? [{ x: 395, y: 25 }, { x: 395, y: 465 }, { x: 25, y: 245 }, { x: 765, y: 245 }]
      : [{ x: 25, y: 245 }, { x: 765, y: 245 }];

    exits.forEach(e => {
      svg += `<rect x="${e.x - 12}" y="${e.y - 8}" width="24" height="16" rx="3" fill="none" stroke="#22c55e" stroke-width="2"/>`;
      svg += `<text x="${e.x}" y="${e.y + 4}" text-anchor="middle" fill="#22c55e" font-size="8" font-family="Inter" font-weight="700">EXIT</text>`;
    });

    // Evacuation routes
    if (this.evacuationRoutes) {
      exits.forEach(e => {
        svg += `<line x1="400" y1="250" x2="${e.x}" y2="${e.y}" stroke="#22c55e" stroke-width="2" stroke-dasharray="8,4" opacity="0.6">
          <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite"/>
        </line>`;
      });
    }

    // Staff markers
    const floorStaff = Simulator.staff.filter(s => s.floor === this.activeFloor && s.status !== 'off-duty');
    floorStaff.forEach((s, i) => {
      const x = 100 + (i % 8) * 85 + Utils.random(-15, 15);
      const y = 160 + Math.floor(i / 8) * 120 + Utils.random(-10, 10);
      const statusColor = s.status === 'available' ? '#22c55e' : s.status === 'responding' ? '#f97316' : '#ef4444';

      svg += `
        <g transform="translate(${x}, ${y})">
          <circle r="14" fill="${s.color}" opacity="0.9"/>
          <circle r="14" fill="none" stroke="${statusColor}" stroke-width="2.5"/>
          <text y="4" text-anchor="middle" fill="white" font-size="8" font-family="Inter" font-weight="700">${s.initials}</text>
          <circle cx="10" cy="-10" r="4" fill="${statusColor}"/>
        </g>
      `;
    });

    // Hazard zones
    this.hazardZones.forEach(h => {
      svg += `
        <circle cx="${h.x}" cy="${h.y}" r="40" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.4)" stroke-width="2" stroke-dasharray="6,3">
          <animate attributeName="r" values="35;45;35" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="${h.x}" y="${h.y + 4}" text-anchor="middle" fill="#ef4444" font-size="9" font-family="Inter" font-weight="700">HAZARD</text>
      `;
    });

    // Floor label
    svg += `<text x="60" y="490" fill="rgba(148,163,184,0.3)" font-size="10" font-family="JetBrains Mono" font-weight="500">${this.activeFloor.toUpperCase()} — AEGIS VENUE MAP</text>`;
    svg += `<text x="740" y="490" text-anchor="end" fill="rgba(148,163,184,0.2)" font-size="9" font-family="JetBrains Mono">LIVE</text>`;
    svg += `<circle cx="720" cy="487" r="3" fill="#22c55e"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>`;

    return svg;
  },

  switchFloor(floor) {
    this.activeFloor = floor;
    this.render();
  },

  toggleEvacRoutes() {
    this.evacuationRoutes = !this.evacuationRoutes;
    this.render();
  },

  markHazard() {
    // Add a random hazard zone
    this.hazardZones.push({
      x: Utils.random(100, 700),
      y: Utils.random(100, 400),
    });
    Toast.show('warning', 'Hazard Zone Marked', `Zone marked on ${this.activeFloor}`);
    this.render();
  },

  bindEvents() {
    EventBus.on('evacuation-update', (data) => {
      if (document.getElementById('view-map').classList.contains('active')) {
        this.render();
      }
    });
  }
};
