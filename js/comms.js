/* ============================================
   AEGIS — Communications Hub View
   ============================================ */

const CommsView = {
  activeChannel: 'ch-emergency',

  render() {
    const container = document.getElementById('view-comms');
    const activeChannelData = Simulator.channels.find(c => c.id === this.activeChannel);

    container.innerHTML = `
      <div class="comms-layout">
        <!-- Channel List -->
        <div class="channel-list">
          <div class="channel-list-header">
            <div class="channel-list-title">Channels</div>
            <button class="btn btn-sm btn-ghost" style="padding: 4px 8px;" title="Add Channel">${Icons.plus}</button>
          </div>
          <div class="channel-search">
            <input type="text" placeholder="Search channels..." id="channel-search-input">
          </div>
          <div class="channel-items" id="channel-items">
            ${Simulator.channels.map(ch => this.renderChannelItem(ch)).join('')}
          </div>
        </div>

        <!-- Message Area -->
        <div class="message-area">
          <div class="message-header">
            <div>
              <div class="message-channel-name">${activeChannelData ? activeChannelData.name : 'Select Channel'}</div>
              <div class="message-channel-status">
                ${activeChannelData ? `${this.getChannelMembers(activeChannelData.type)} members • ${activeChannelData.type === 'emergency' ? 'Priority Channel' : 'Active'}` : ''}
              </div>
            </div>
            <div class="flex items-center gap-md">
              <div class="flex items-center gap-sm">
                <div class="status-dot available pulse-green"></div>
                <span class="text-xs text-tertiary">LIVE</span>
              </div>
            </div>
          </div>

          <div class="message-list" id="message-list">
            ${this.renderMessages()}
          </div>

          <div class="message-input-area">
            <div class="message-input-wrapper">
              <select class="priority-select" id="msg-priority">
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
                <option value="flash">Flash</option>
              </select>
              <textarea class="message-input" id="msg-input" placeholder="Type a message..." rows="1" onkeydown="CommsView.handleKeyDown(event)"></textarea>
              <button class="message-send-btn" onclick="CommsView.sendMessage()" id="btn-send-msg">
                ${Icons.send}
              </button>
            </div>
          </div>
        </div>

        <!-- Broadcast Panel -->
        <div class="broadcast-panel">
          <div class="broadcast-header">
            <div class="broadcast-title">Command Panel</div>
          </div>
          <div class="broadcast-content">
            <!-- Emergency Services -->
            <div class="broadcast-section">
              <div class="broadcast-section-title">Emergency Services</div>
              <div class="emergency-service">
                <div class="emergency-service-icon" style="background: var(--severity-critical-dim); color: var(--severity-critical);">${Icons.flame}</div>
                <div class="emergency-service-name">Fire Dept.</div>
                <div class="service-status connected">Online</div>
              </div>
              <div class="emergency-service">
                <div class="emergency-service-icon" style="background: var(--accent-blue-dim); color: var(--accent-blue);">${Icons.shield}</div>
                <div class="emergency-service-name">Police</div>
                <div class="service-status connected">Online</div>
              </div>
              <div class="emergency-service">
                <div class="emergency-service-icon" style="background: var(--severity-high-dim); color: var(--severity-high);">${Icons.ambulance}</div>
                <div class="emergency-service-name">Paramedics</div>
                <div class="service-status standby">Standby</div>
              </div>
            </div>

            <!-- Broadcast Actions -->
            <div class="broadcast-section">
              <div class="broadcast-section-title">Broadcast</div>
              <button class="btn btn-danger btn-sm w-full" onclick="CommsView.broadcast('all')" style="justify-content: center; margin-bottom: 6px;">
                ${Icons.megaphone} Alert All Staff
              </button>
              <button class="btn btn-warning btn-sm w-full" onclick="CommsView.broadcast('guests')" style="justify-content: center; margin-bottom: 6px;">
                ${Icons.bell} Notify Guests
              </button>
              <button class="btn btn-ghost btn-sm w-full" onclick="CommsView.broadcast('floor')" style="justify-content: center;">
                ${Icons.building} Floor-Specific Alert
              </button>
            </div>

            <!-- Active Responders -->
            <div class="broadcast-section">
              <div class="broadcast-section-title">Active Responders</div>
              <div class="personnel-grid" id="comms-responders">
                ${Simulator.staff.filter(s => s.status === 'responding' || s.status === 'engaged').slice(0, 6).map(s => `
                  <div class="personnel-item">
                    <div class="personnel-avatar" style="background: ${s.color}">
                      <div class="status-ring ${s.status}"></div>
                      ${s.initials}
                    </div>
                    <div class="personnel-info">
                      <div class="personnel-name">${s.name.split(' ')[0]}</div>
                      <div class="personnel-role">${STAFF_ROLES[s.role].label}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.scrollToBottom();
    this.bindEvents();
  },

  renderChannelItem(ch) {
    const iconClass = ch.type === 'emergency' ? 'emergency' : ch.type === 'incident' ? 'incident' : ch.type === 'team' ? 'team' : 'general';
    const iconText = ch.type === 'emergency' ? '🚨' : ch.type === 'incident' ? '⚠️' : ch.type === 'team' ? '👥' : '📢';

    return `
      <div class="channel-item ${ch.id === this.activeChannel ? 'active' : ''}" onclick="CommsView.switchChannel('${ch.id}')">
        <div class="channel-icon ${iconClass}">${iconText}</div>
        <div class="channel-info">
          <div class="channel-name">${ch.name}</div>
          <div class="channel-preview">${ch.lastMessage}</div>
        </div>
        <div class="flex flex-col items-center gap-xs">
          <div class="channel-time">${Utils.formatTimeShort(ch.lastTime)}</div>
          ${ch.unread > 0 ? `<div class="channel-badge">${ch.unread}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderMessages() {
    const msgs = Simulator.messages[this.activeChannel] || [];
    if (msgs.length === 0) {
      return '<div class="empty-state"><p>No messages in this channel yet</p></div>';
    }

    return msgs.map(msg => {
      const isOwn = msg.sender === 'You';
      const priorityClass = msg.priority !== 'routine' ? `priority-${msg.priority}` : '';

      return `
        <div class="message ${isOwn ? 'own' : ''}">
          <div class="message-avatar" style="background: ${msg.color}">${msg.initials}</div>
          <div class="message-body">
            <div class="message-meta">
              <span class="message-sender">${msg.sender}</span>
              <span class="message-role">${msg.role}</span>
              <span class="message-timestamp">${Utils.formatTimeShort(msg.time)}</span>
              ${msg.priority !== 'routine' ? `<span class="badge-severity ${msg.priority === 'critical' || msg.priority === 'flash' ? 'critical' : 'high'}">${msg.priority}</span>` : ''}
            </div>
            <div class="message-bubble ${priorityClass}">${msg.text}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  getChannelMembers(type) {
    if (type === 'emergency') return Simulator.staff.filter(s => s.status !== 'off-duty').length;
    if (type === 'incident') return Utils.random(3, 8);
    if (type === 'team') return Utils.random(4, 12);
    return Simulator.staff.length;
  },

  switchChannel(channelId) {
    this.activeChannel = channelId;
    const channel = Simulator.channels.find(c => c.id === channelId);
    if (channel) channel.unread = 0;
    this.render();
  },

  sendMessage() {
    const input = document.getElementById('msg-input');
    const priority = document.getElementById('msg-priority').value;
    const text = input.value.trim();
    if (!text) return;

    const msg = {
      id: `m-${Utils.shortId()}`,
      sender: 'You',
      role: 'Operations Lead',
      initials: 'OP',
      color: '#3b82f6',
      text: text,
      time: new Date().toISOString(),
      priority: priority,
    };

    if (!Simulator.messages[this.activeChannel]) Simulator.messages[this.activeChannel] = [];
    Simulator.messages[this.activeChannel].push(msg);

    input.value = '';
    document.getElementById('msg-priority').value = 'routine';

    this.renderMessageList();
    this.scrollToBottom();
  },

  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  renderMessageList() {
    const list = document.getElementById('message-list');
    if (list) list.innerHTML = this.renderMessages();
  },

  scrollToBottom() {
    const list = document.getElementById('message-list');
    if (list) {
      setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    }
  },

  broadcast(target) {
    const msgMap = {
      all: 'BROADCAST: All staff — emergency alert issued. Check your assigned channels for updates.',
      guests: 'GUEST ALERT: Attention all guests. Please follow staff instructions. Your safety is our priority.',
      floor: 'FLOOR ALERT: Personnel on affected floors, initiate safety protocols immediately.',
    };

    Toast.show('info', 'Broadcast Sent', msgMap[target]);

    const msg = {
      id: `m-${Utils.shortId()}`,
      sender: 'AEGIS System',
      role: 'System',
      initials: 'SY',
      color: '#3b82f6',
      text: msgMap[target],
      time: new Date().toISOString(),
      priority: 'flash',
    };

    if (!Simulator.messages['ch-emergency']) Simulator.messages['ch-emergency'] = [];
    Simulator.messages['ch-emergency'].push(msg);

    if (this.activeChannel === 'ch-emergency') {
      this.renderMessageList();
      this.scrollToBottom();
    }
  },

  bindEvents() {
    EventBus.on('new-message', ({ channelId, message }) => {
      if (channelId === this.activeChannel) {
        this.renderMessageList();
        this.scrollToBottom();
      } else {
        // Update channel unread count
        const items = document.getElementById('channel-items');
        if (items) {
          const ch = Simulator.channels.find(c => c.id === channelId);
          if (ch) {
            ch.unread = (ch.unread || 0) + 1;
            items.innerHTML = Simulator.channels.map(c => this.renderChannelItem(c)).join('');
          }
        }
      }
    });
  }
};
