/* ============================================
   AEGIS — App Router & Core
   ============================================ */

const App = {
  currentView: 'dashboard',
  clockInterval: null,

  init() {
    // Initialize simulator
    Simulator.init();
    Toast.init();

    // Start clock
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);

    // Setup navigation
    this.setupNav();

    // Render initial view
    this.navigate('dashboard');

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash);
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); this.navigate('dashboard'); }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); this.navigate('incidents'); }
      if (e.ctrlKey && e.key === '3') { e.preventDefault(); this.navigate('comms'); }
      if (e.ctrlKey && e.key === '4') { e.preventDefault(); this.navigate('personnel'); }
      if (e.ctrlKey && e.key === '5') { e.preventDefault(); this.navigate('map'); }
    });

    console.log('%c AEGIS %c Crisis Response System Initialized ', 'background: #ef4444; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;', 'background: #1a2340; color: #94a3b8; padding: 4px 8px; border-radius: 0 4px 4px 0;');
  },

  setupNav() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) this.navigate(view);
      });
    });
  },

  navigate(viewName) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update active view
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });

    const viewEl = document.getElementById(`view-${viewName}`);
    if (viewEl) {
      viewEl.classList.add('active');
    }

    // Update topbar title
    const titles = {
      dashboard: 'Command Dashboard',
      incidents: 'Incident Management',
      comms: 'Communications Hub',
      personnel: 'Personnel Tracker',
      map: 'Venue Map',
    };

    const titleEl = document.querySelector('.topbar-title');
    if (titleEl) titleEl.textContent = titles[viewName] || 'AEGIS';

    // Render view content
    this.currentView = viewName;
    window.location.hash = viewName;

    switch (viewName) {
      case 'dashboard': DashboardView.render(); break;
      case 'incidents': IncidentView.render(); break;
      case 'comms': CommsView.render(); break;
      case 'personnel': PersonnelView.render(); break;
      case 'map': MapView.render(); break;
    }
  },

  updateClock() {
    const now = new Date();
    const clockEl = document.querySelector('.topbar-clock');
    const dateEl = document.querySelector('.topbar-date');

    if (clockEl) clockEl.textContent = Utils.formatTime(now);
    if (dateEl) dateEl.textContent = Utils.formatDate(now);

    // Update threat badge in topbar
    const badge = document.querySelector('.topbar .threat-badge');
    if (badge) {
      badge.className = `threat-badge ${Simulator.threatLevel}`;
      badge.innerHTML = `<div class="dot ${Simulator.threatLevel === 'red' ? 'blink-alert' : ''}"></div>${Simulator.threatLevel.toUpperCase()}`;
    }
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');

    const detailOverlay = document.getElementById('incident-detail-overlay');
    if (detailOverlay) detailOverlay.classList.remove('active');
  },
};

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
