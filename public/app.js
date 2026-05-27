// Constants and Configuration
const API_BASE = '/v1';
const MACHINE_ID = 'A1B2C3D4';

// Application State
let isOnline = true;
let terminalSchools = [];
let activeTerminalSchool = null;
let terminalCards = [];
let syncIntervalId = null;
let currentReportData = [];
let currentReportRange = null;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  initDateTimeInput();
  initEventListeners();
  
  // Set default report dates to May 2026
  document.getElementById('report-from-date').value = '2026-05-01';
  document.getElementById('report-to-date').value = '2026-05-31';
  document.getElementById('scan-filter-from').value = '2026-05-01';
  document.getElementById('scan-filter-to').value = '2026-05-31';

  // Load public schools for the simulator terminal
  loadTerminalSchools().then(() => {
    // Check user login session
    checkSession();
    startSyncInterval();
  });
});

// Helpers for date/time formatting and Live Clock
function getLocalDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLocalDatetimeString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

let clockInterval;
function startLiveClock() {
  const checkbox = document.getElementById('live-clock-checkbox');
  const dtInput = document.getElementById('terminal-scan-time');
  
  if (clockInterval) clearInterval(clockInterval);
  
  if (checkbox && checkbox.checked && dtInput) {
    dtInput.value = getLocalDatetimeString(new Date());
    dtInput.readOnly = true;
    dtInput.style.opacity = '0.7';
  } else if (dtInput) {
    dtInput.readOnly = false;
    dtInput.style.opacity = '1';
  }
  
  clockInterval = setInterval(() => {
    if (checkbox && checkbox.checked && dtInput) {
      dtInput.value = getLocalDatetimeString(new Date());
    }
  }, 1000);
}

function toggleLiveClock() {
  startLiveClock();
}

function initDateTimeInput() {
  startLiveClock();
}

// Session Validation & UI state switching
function checkSession() {
  const token = sessionStorage.getItem('wlyl_token');
  const role = sessionStorage.getItem('wlyl_role');
  const username = sessionStorage.getItem('wlyl_username');
  const body = document.body;

  if (token) {
    // Authenticated state
    body.classList.remove('logged-in-super', 'logged-in-school');
    document.getElementById('login-overlay-screen').style.display = 'none';
    document.getElementById('dashboard-portal-view').style.display = 'flex';
    document.getElementById('user-profile-badge').style.display = 'flex';
    
    // Establish real-time connection
    connectSSE();
    
    if (role === 'super') {
      body.classList.add('logged-in-super');
      document.getElementById('session-username').textContent = 'Super Admin';
      switchTab('super-panel');
      const banner = document.getElementById('licence-warning-banner');
      if (banner) banner.style.display = 'none';
      loadTerminalSchools();
    } else {
      body.classList.add('logged-in-school');
      const schoolName = sessionStorage.getItem('wlyl_school_name') || 'School Admin';
      document.getElementById('session-username').textContent = schoolName;
      switchTab('overview');
      checkSchoolActiveStatus();
      loadTerminalSchools();
    }
  } else {
    // Unauthenticated state
    body.classList.remove('logged-in-super', 'logged-in-school');
    document.getElementById('login-overlay-screen').style.display = 'flex';
    document.getElementById('dashboard-portal-view').style.display = 'none';
    document.getElementById('user-profile-badge').style.display = 'none';
    const banner = document.getElementById('licence-warning-banner');
    if (banner) banner.style.display = 'none';
    loadTerminalSchools();
  }
}

// Check school active status and update warning banner
async function checkSchoolActiveStatus() {
  const schoolId = sessionStorage.getItem('wlyl_school_id');
  const role = sessionStorage.getItem('wlyl_role');
  const banner = document.getElementById('licence-warning-banner');
  if (!banner) return;

  if (!schoolId || role !== 'school') {
    banner.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/ping`, { headers: getSessionHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.active === false) {
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Failed to check active status:', err);
  }
}

// Display dynamic toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // FontAwesome icon selection
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error' || type === 'danger') icon = 'fa-triangle-exclamation';
  if (type === 'warning') icon = 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger CSS transition
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto-remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// Get Session Token Headers
function getSessionHeaders() {
  const token = sessionStorage.getItem('wlyl_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// --- LOGIN / LOGOUT HANDLERS ---

async function handleLogin() {
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error-msg');
  
  const username = usernameEl.value.trim();
  const password = passwordEl.value.trim();
  
  if (!username || !password) {
    errorEl.textContent = 'Please enter both username and password';
    errorEl.style.display = 'block';
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      sessionStorage.setItem('wlyl_token', data.token);
      sessionStorage.setItem('wlyl_role', data.role);
      sessionStorage.setItem('wlyl_username', username);
      
      if (data.role === 'school') {
        sessionStorage.setItem('wlyl_school_id', data.school_id);
        sessionStorage.setItem('wlyl_school_name', data.school_name);
      }
      
      errorEl.style.display = 'none';
      usernameEl.value = '';
      passwordEl.value = '';
      
      checkSession();
    } else {
      errorEl.textContent = data.message || 'Login failed';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Connection to API server failed';
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  sessionStorage.clear();
  checkSession();
}

// Switch tabs inside Dashboard
function switchTab(tabId) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  // Deactivate all buttons
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
  
  // Display active panel
  document.getElementById(tabId).classList.add('active');
  
  // Find button targeting this tab and set active
  const btn = Array.from(document.querySelectorAll('.tab')).find(b => b.getAttribute('onclick').includes(tabId));
  if (btn) btn.classList.add('on');

  // Trigger content loading
  if (tabId === 'overview') {
    refreshDashboard();
  } else if (tabId === 'scan-events') {
    loadRawScans();
  } else if (tabId === 'cards-mgmt') {
    loadCards();
  } else if (tabId === 'licence-mgmt') {
    loadLicenceInfo();
  } else if (tabId === 'super-panel') {
    loadSuperSchools();
  } else if (tabId === 'super-scans') {
    loadSuperScansDropdown();
  }
}

// Terminal Console Log Helper
function logTerminal(message, type = 'info') {
  const consoleEl = document.getElementById('terminal-console');
  const logRow = document.createElement('div');
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  logRow.className = `console-log ${type}`;
  logRow.textContent = `[${timeStr}] ${message}`;
  consoleEl.appendChild(logRow);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// --- TERMINAL MULTI-SCHOOL SIMULATOR LOGIC ---

// Fetch the list of schools to populate the terminal simulator dropdown
async function loadTerminalSchools() {
  try {
    const res = await fetch(`${API_BASE}/schools/public`);
    if (!res.ok) return;
    const data = await res.json();
    terminalSchools = data.schools;
    
    const role = sessionStorage.getItem('wlyl_role');
    const schoolId = sessionStorage.getItem('wlyl_school_id');
    
    const select = document.getElementById('select-terminal-school');
    select.innerHTML = '';
    
    let filteredSchools = terminalSchools;
    if (role === 'school' && schoolId) {
      filteredSchools = terminalSchools.filter(s => s.school_id === schoolId);
      select.disabled = true;
      const selectorGroup = select.closest('.form-group');
      if (selectorGroup) {
        selectorGroup.style.opacity = '0.85';
        const label = selectorGroup.querySelector('label');
        if (label && !label.innerHTML.includes('fa-lock')) {
          label.innerHTML = `<i class="fa-solid fa-lock" style="color: var(--color-warning);"></i> School Terminal Simulator (Locked)`;
        }
      }
    } else {
      select.disabled = false;
      const selectorGroup = select.closest('.form-group');
      if (selectorGroup) {
        selectorGroup.style.opacity = '1';
        const label = selectorGroup.querySelector('label');
        if (label) {
          label.innerHTML = `<i class="fa-solid fa-school"></i> Active School Simulator`;
        }
      }
    }
    
    filteredSchools.forEach(school => {
      const opt = document.createElement('option');
      opt.value = school.school_id;
      opt.textContent = school.school_name;
      select.appendChild(opt);
    });
    
    // Bind school selector listener
    select.onchange = () => {
      onTerminalSchoolChange(select.value);
    };

    // Load initial simulator school
    if (filteredSchools.length > 0) {
      onTerminalSchoolChange(filteredSchools[0].school_id);
    }
  } catch (err) {
    logTerminal('Terminal: Failed to query school list from server.', 'error');
  }
}

// When the active school being simulated is changed
async function onTerminalSchoolChange(schoolId) {
  activeTerminalSchool = terminalSchools.find(s => s.school_id === schoolId);
  if (!activeTerminalSchool) return;

  logTerminal(`Terminal switched location: ${activeTerminalSchool.school_name} (${schoolId})`, 'info');
  
  // Initialize Local DB storage keys for this school
  initLocalDbForSchool(schoolId);
  
  // Retrieve card credentials for this school from server (mimics scanning terminal caching cards)
  await loadTerminalCards(activeTerminalSchool);
}

// Initialize SQLite simulator counts for active school
function initLocalDbForSchool(schoolId) {
  const syncKey = `wlyl_local_synced_${schoolId}`;
  const queueKey = `wlyl_local_queue_${schoolId}`;
  
  if (localStorage.getItem(syncKey) === null) {
    localStorage.setItem(syncKey, '0');
  }
  if (localStorage.getItem(queueKey) === null) {
    localStorage.setItem(queueKey, JSON.stringify([]));
  }
  
  updateSyncStatsUI();
}

function updateSyncStatsUI() {
  if (!activeTerminalSchool) return;
  const schoolId = activeTerminalSchool.school_id;
  
  const syncedCount = localStorage.getItem(`wlyl_local_synced_${schoolId}`) || '0';
  const queue = JSON.parse(localStorage.getItem(`wlyl_local_queue_${schoolId}`) || '[]');
  
  document.getElementById('local-synced-count').textContent = syncedCount;
  document.getElementById('local-queue-count').textContent = queue.length;
}

// Load staff cards for terminal selector
async function loadTerminalCards(school) {
  const cardSelect = document.getElementById('select-staff-card');
  cardSelect.innerHTML = '';
  
  try {
    // Call GET /v1/cards with school API key (mimics terminal sync request)
    const res = await fetch(`${API_BASE}/cards?active=true`, {
      headers: {
        'Authorization': `Bearer ${school.api_key}`,
        'X-School-ID': school.school_id,
        'X-Device-ID': MACHINE_ID
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      terminalCards = data.cards;
      
      terminalCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.card_id;
        opt.textContent = `${card.name} (${card.department})`;
        cardSelect.appendChild(opt);
      });
      logTerminal(`Cached ${terminalCards.length} registered cards locally in SQLite.`, 'success');
    } else {
      logTerminal(`RFID Sync Failed: Server returned status code ${res.status}.`, 'error');
    }
  } catch (err) {
    logTerminal('RFID Sync Failed: Cloud server offline.', 'warning');
  }
}

// Setup simulator event listeners
function initEventListeners() {
  // Toggle Online/Offline Connection Switch
  const toggleBtn = document.getElementById('connection-toggle');
  toggleBtn.addEventListener('click', () => {
    isOnline = !isOnline;
    const indicator = document.querySelector('#connection-toggle .connection-status-indicator');
    const textEl = document.getElementById('connection-text');
    
    if (isOnline) {
      toggleBtn.classList.remove('offline');
      textEl.textContent = 'ONLINE';
      logTerminal('System connection state: ONLINE. Sync engine active.', 'success');
      document.getElementById('server-status').style.borderColor = 'rgba(16, 185, 129, 0.2)';
      document.getElementById('server-status').style.background = 'rgba(16, 185, 129, 0.1)';
      document.getElementById('server-status').querySelector('span').textContent = 'Cloud API: Online';
      document.getElementById('server-status').querySelector('.server-status-dot').style.backgroundColor = 'var(--color-success)';
      syncOfflineQueue();
    } else {
      toggleBtn.classList.add('offline');
      textEl.textContent = 'OFFLINE';
      logTerminal('System connection state: OFFLINE. Local SQLite saving active.', 'warning');
      document.getElementById('server-status').style.borderColor = 'rgba(239, 68, 68, 0.2)';
      document.getElementById('server-status').style.background = 'rgba(239, 68, 68, 0.1)';
      document.getElementById('server-status').querySelector('span').textContent = 'Cloud API: Offline';
      document.getElementById('server-status').querySelector('.server-status-dot').style.backgroundColor = 'var(--color-danger)';
    }
  });

  // Tap Card triggers
  document.getElementById('btn-tap-card').addEventListener('click', handleCardTap);
  document.getElementById('rfid-reader').addEventListener('click', handleCardTap);
  
  // Force sync
  document.getElementById('btn-force-sync').addEventListener('click', () => {
    if (!isOnline) {
      logTerminal('Sync failed: Terminal is currently OFFLINE.', 'error');
      return;
    }
    syncOfflineQueue();
  });
}

// Handle card swiping inside the simulator
async function handleCardTap() {
  if (!activeTerminalSchool) {
    logTerminal('Terminal inactive: No school configured.', 'error');
    blinkReader('scan-err');
    return;
  }

  const cardId = document.getElementById('select-staff-card').value;
  if (!cardId) {
    logTerminal('Swipe rejected: No staff card registered for this school.', 'error');
    blinkReader('scan-err');
    return;
  }
  
  const card = terminalCards.find(c => c.card_id === cardId);
  const scanTimeInput = document.getElementById('terminal-scan-time').value;
  
  if (!scanTimeInput) {
    logTerminal('Swipe rejected: Invalid timestamp.', 'error');
    blinkReader('scan-err');
    return;
  }

  const parsedDate = new Date(scanTimeInput);
  const formattedDate = parsedDate.toISOString().replace('T', ' ').substring(0, 19);
  
  let scanType = document.getElementById('terminal-scan-type').value;
  const hour = parsedDate.getHours();
  
  if (scanType === 'auto') {
    if (hour < 12) {
      scanType = 'morning_in';
    } else if (hour >= 12 && hour < 16) {
      scanType = 'afternoon_in';
    } else {
      scanType = 'out';
    }
  }

  let isLate = false;
  if (scanType === 'morning_in' && (hour > 9 || (hour === 9 && parsedDate.getMinutes() > 0))) {
    isLate = true;
  }

  const scanRecord = {
    card_id: cardId,
    name: card.name,
    department: card.department,
    session: (scanType === 'morning_in') ? 'Morning' : 'Afternoon',
    scan_time: formattedDate,
    scan_type: scanType,
    is_late: isLate,
    out_time: '',
    duration_minutes: 0,
    scan_mode: 'IN_IN_OUT',
    entry_point: 'Main Gate',
    device: 'RFID Reader',
    source_port: 'HID',
    school_id: activeTerminalSchool.school_id,
    machine_id: MACHINE_ID
  };

  logTerminal(`RFID card swiped: ID [${cardId}] (${card.name})`);

  if (isOnline) {
    blinkReader('active');
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeTerminalSchool.api_key}`,
          'X-School-ID': activeTerminalSchool.school_id,
          'X-Device-ID': MACHINE_ID
        },
        body: JSON.stringify(scanRecord)
      });
      
      const data = await res.json();
      
      if (res.status === 200 && data.success) {
        logTerminal(`Sync OK: Server recorded scan. Record ID: ${data.record_id}`, 'success');
        blinkReader('scan-ok');
        
        // Save synced stat
        const syncKey = `wlyl_local_synced_${activeTerminalSchool.school_id}`;
        const syncedCount = parseInt(localStorage.getItem(syncKey) || '0') + 1;
        localStorage.setItem(syncKey, syncedCount.toString());
        updateSyncStatsUI();
        
        // Refresh dashboard if logged in as active school
        const activeSchoolSession = sessionStorage.getItem('wlyl_school_id');
        if (activeSchoolSession === activeTerminalSchool.school_id) {
          refreshDashboard();
        }
      } else if (res.status === 409) {
        logTerminal(`Sync REJECTED: Duplicate scan. ${data.message}`, 'warning');
        blinkReader('scan-err');
      } else {
        logTerminal(`Server Error [${res.status}]: ${data.message || 'Unknown error'}`, 'error');
        blinkReader('scan-err');
      }
    } catch (err) {
      logTerminal(`Network Error: Cloud unreachable. Saving to SQLite queue...`, 'warning');
      queueOfflineScan(scanRecord);
      blinkReader('scan-ok');
    }
  } else {
    queueOfflineScan(scanRecord);
    blinkReader('scan-ok');
  }
}

// Queue offline scans in LocalStorage by school
function queueOfflineScan(scanRecord) {
  const schoolId = activeTerminalSchool.school_id;
  const queueKey = `wlyl_local_queue_${schoolId}`;
  
  const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
  const local_id = queue.length + 1;
  
  queue.push({
    local_id,
    ...scanRecord
  });
  
  localStorage.setItem(queueKey, JSON.stringify(queue));
  updateSyncStatsUI();
  
  logTerminal(`SQLite: Saved in offline queue (Local ID: ${local_id})`, 'info');
}

// Sync offline queue for active simulated school
async function syncOfflineQueue() {
  if (!activeTerminalSchool) return;
  const schoolId = activeTerminalSchool.school_id;
  const queueKey = `wlyl_local_queue_${schoolId}`;
  
  const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
  if (queue.length === 0) return;
  
  logTerminal(`Batch Sync: Sending ${queue.length} queued scans for ${activeTerminalSchool.school_name}...`, 'info');
  
  try {
    const res = await fetch(`${API_BASE}/scan/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeTerminalSchool.api_key}`,
        'X-School-ID': schoolId,
        'X-Device-ID': MACHINE_ID
      },
      body: JSON.stringify({
        scans: queue,
        school_id: schoolId,
        machine_id: MACHINE_ID
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        logTerminal(`Batch Sync Completed! Synced: ${data.synced}, Failed/Duplicates: ${data.failed}`, 'success');
        
        localStorage.setItem(queueKey, JSON.stringify([]));
        
        const syncKey = `wlyl_local_synced_${schoolId}`;
        const syncedCount = parseInt(localStorage.getItem(syncKey) || '0') + data.synced;
        localStorage.setItem(syncKey, syncedCount.toString());
        
        updateSyncStatsUI();
        
        // Refresh dashboard if active
        const activeSchoolSession = sessionStorage.getItem('wlyl_school_id');
        if (activeSchoolSession === schoolId) {
          refreshDashboard();
        }
      }
    } else {
      logTerminal(`Batch Sync Failed. Server returned code ${res.status}. Will retry...`, 'error');
    }
  } catch (err) {
    logTerminal(`Batch Sync Failed: Connection lost. Will retry...`, 'error');
  }
}

// Start recurring sync loop
function startSyncInterval() {
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(() => {
    if (isOnline) {
      syncOfflineQueue();
    }
  }, 10000);
}

function blinkReader(cls) {
  const reader = document.getElementById('rfid-reader');
  const txt = document.getElementById('scanner-status-text');
  
  reader.className = 'scanner-hardware';
  void reader.offsetWidth; 
  reader.classList.add(cls);
  
  if (cls === 'scan-ok') {
    txt.textContent = 'SCAN OK';
    setTimeout(() => {
      reader.className = 'scanner-hardware';
      txt.textContent = 'TAP CARD HERE';
    }, 1500);
  } else if (cls === 'scan-err') {
    txt.textContent = 'SCAN ERROR';
    setTimeout(() => {
      reader.className = 'scanner-hardware';
      txt.textContent = 'TAP CARD HERE';
    }, 1500);
  } else if (cls === 'active') {
    txt.textContent = 'READING CARD...';
  }
}

// --- SUPER ADMIN MANAGEMENT METHODS ---

// Load schools list for super admin dashboard
async function loadSuperSchools() {
  try {
    const res = await fetch(`${API_BASE}/admin/schools`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const tbody = document.getElementById('super-schools-table-body');
    tbody.innerHTML = '';
    
    data.schools.forEach(school => {
      const tr = document.createElement('tr');
      const statusTag = school.active ? '<span class="tag t-green">Active (Activated)</span>' : '<span class="tag t-amber">Pending Activation</span>';
      
      const start = school.subscription_start || 'N/A';
      const expire = school.subscription_expire || 'N/A';
      const paid = school.amount_paid ? `INR ${Number(school.amount_paid).toLocaleString()}` : 'Free';

      tr.innerHTML = `
        <td><strong style="font-family: var(--font-mono);">${school.school_id}</strong></td>
        <td style="font-weight: 600;">${school.school_name}</td>
        <td>
          <span style="font-size:0.75rem; color:var(--color-text-secondary);">User:</span> <code>${school.username}</code><br>
          <span style="font-size:0.75rem; color:var(--color-text-secondary);">Pass:</span> <code>${school.password}</code>
        </td>
        <td>
          <span class="tag t-blue" style="font-weight:700;">${school.card_count} active cards</span><br>
          <span style="font-size:0.7rem; color:var(--color-text-secondary);">${school.scan_count} sync records</span>
        </td>
        <td style="font-size:0.75rem;">
          <span style="color:var(--color-text-secondary);">Start:</span> <code>${start}</code><br>
          <span style="color:var(--color-text-secondary);">End:</span> <code>${expire}</code>
        </td>
        <td style="font-weight: 600; font-family: var(--font-mono); font-size:0.75rem;">${paid}</td>
        <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--color-primary);">${school.licence_key}</td>
        <td>${statusTag}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// Create new school tenant from super admin view
async function createSchoolTenant() {
  const school_name = document.getElementById('new-school-name').value.trim();
  const username = document.getElementById('new-school-username').value.trim();
  const password = document.getElementById('new-school-password').value.trim();
  const subscription_start = document.getElementById('new-school-start').value;
  const subscription_expire = document.getElementById('new-school-expire').value;
  const amount_paid = document.getElementById('new-school-paid').value;
  
  if (!school_name || !username || !password) {
    alert('Please fill out all school details fields!');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/admin/schools`, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify({
        school_name,
        username,
        password,
        subscription_start,
        subscription_expire,
        amount_paid
      })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      alert(`School Tenant Created Successfully!\nLicence Key: ${data.school.licence_key}\nAPI Key: ${data.school.api_key}`);
      
      closeAddSchoolModal();
      
      // Reload schools list
      loadSuperSchools();
      
      // Reload terminal selector schools
      await loadTerminalSchools();
    } else {
      alert(`Tenant creation failed: ${data.message}`);
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}

// Modal open/close for Add School Tenant
function openAddSchoolModal() {
  document.getElementById('new-school-name').value = '';
  document.getElementById('new-school-username').value = '';
  document.getElementById('new-school-password').value = '';
  
  const today = new Date().toISOString().substring(0, 10);
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  
  document.getElementById('new-school-start').value = today;
  document.getElementById('new-school-expire').value = nextYear;
  document.getElementById('new-school-paid').value = '15000';
  
  document.getElementById('add-school-modal').classList.add('active');
}

function closeAddSchoolModal() {
  document.getElementById('add-school-modal').classList.remove('active');
}

// Load Super Scans Dropdown of Schools
async function loadSuperScansDropdown() {
  try {
    const res = await fetch(`${API_BASE}/admin/schools`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const select = document.getElementById('super-scan-school');
    select.innerHTML = '<option value="">All Schools</option>';
    
    data.schools.forEach(school => {
      const opt = document.createElement('option');
      opt.value = school.school_id;
      opt.textContent = school.school_name;
      select.appendChild(opt);
    });
    
    loadSuperScans();
  } catch (err) {
    console.error(err);
  }
}

// Load global scans audit log
async function loadSuperScans() {
  const schoolId = document.getElementById('super-scan-school').value;
  let url = `${API_BASE}/attendance?from=2026-05-01&to=2026-05-31&per_page=100`;
  if (schoolId) url += `&school_id=${schoolId}`;
  
  try {
    const res = await fetch(url, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const tbody = document.getElementById('super-scans-table-body');
    tbody.innerHTML = '';
    
    if (data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-secondary);">No scans recorded yet.</td></tr>`;
      return;
    }
    
    data.records.forEach(scan => {
      const tr = document.createElement('tr');
      const scanTypeTag = getScanTypeTag(scan.scan_type);
      const isLateTag = scan.is_late ? '<span class="tag t-red">LATE</span>' : '<span class="tag t-gray">ON TIME</span>';
      
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size:0.75rem;">${scan.id}</td>
        <td style="font-family: var(--font-mono); font-size:0.75rem; font-weight:700; color: var(--color-primary);">${scan.school_id}</td>
        <td style="font-family: var(--font-mono); font-size:0.75rem;">${scan.card_id}</td>
        <td style="font-weight: 600;">${scan.name}</td>
        <td>${scan.department}</td>
        <td>${scan.scan_time}</td>
        <td>${scanTypeTag}</td>
        <td>${isLateTag}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// --- SCHOOL ADMIN SPECIFIC MANAGEMENT METHODS ---

// Refresh dashboard overview
async function refreshDashboard() {
  const schoolId = sessionStorage.getItem('wlyl_school_id');
  if (!schoolId) return;

  try {
    // 1. Get school-specific cards
    await loadCards();
    
    // 2. Fetch today's scans (2026-05-26)
    const today = '2026-05-26';
    const res = await fetch(`${API_BASE}/attendance?from=${today}&to=${today}`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const streamContainer = document.getElementById('live-attendance-stream');
    streamContainer.innerHTML = '';
    
    if (data.records.length === 0) {
      streamContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--color-text-secondary);">No scans recorded today yet. Swipe a card on the left terminal!</div>`;
    } else {
      data.records.forEach(record => {
        const row = document.createElement('div');
        row.className = 'live-stream-row';
        const scanTypeTag = getScanTypeTag(record.scan_type);
        const timeVal = record.scan_time.split(' ')[1];
        
        row.innerHTML = `
          <div class="live-stream-details">
            <span class="live-stream-name">${record.name}</span>
            <span class="live-stream-meta">${record.card_id} &bull; ${record.department}</span>
          </div>
          <div class="live-stream-time-badge">
            <span class="live-stream-time">${timeVal}</span>
            ${scanTypeTag}
          </div>
        `;
        streamContainer.appendChild(row);
      });
    }
    
    // 3. Retrieve absent metrics
    const absentRes = await fetch(`${API_BASE}/attendance/absent?date=${today}`, { headers: getSessionHeaders() });
    if (absentRes.ok) {
      const absentData = await absentRes.json();
      const totalCards = cardsList.filter(c => c.active).length;
      const presentCount = totalCards - absentData.absent_count;
      
      document.getElementById('stat-present').textContent = presentCount;
      document.getElementById('stat-present-sub').textContent = `Out of ${totalCards} active staff`;
      
      document.getElementById('stat-late').textContent = absentData.late_count;
      document.getElementById('stat-late-sub').textContent = `${((absentData.late_count / (presentCount || 1)) * 100).toFixed(0)}% of present staff`;
      
      document.getElementById('stat-absent').textContent = absentData.absent_count;
      document.getElementById('stat-absent-sub').textContent = `${((absentData.absent_count / totalCards) * 100).toFixed(0)}% absenteeism rate`;
    }

    // 4. Update Dept summaries
    const summaryRes = await fetch(`${API_BASE}/attendance/summary?from=2026-05-01&to=2026-05-31`, { headers: getSessionHeaders() });
    if (summaryRes.ok) {
      const sumData = await summaryRes.json();
      const tbody = document.getElementById('dept-summary-table-body');
      tbody.innerHTML = '';
      
      sumData.department_totals.forEach(dept => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${dept.department}</strong> <span style="font-size:0.75rem; color:var(--color-text-secondary);">(${dept.staff_count} staff)</span></td>
          <td><span class="tag t-green" style="font-size:0.75rem;">${dept.avg_present} days</span></td>
          <td><span class="tag t-red" style="font-size:0.75rem;">${dept.avg_absent} days</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

  } catch (err) {
    console.error(err);
  }
}

// Fetch cards list
async function loadCards() {
  try {
    const res = await fetch(`${API_BASE}/cards`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    cardsList = data.cards;
    
    // Populate cards grid
    const cardsGrid = document.getElementById('staff-cards-grid');
    cardsGrid.innerHTML = '';
    
    cardsList.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'staff-card';
      const statusTag = card.active ? '<span class="tag t-green">Active</span>' : '<span class="tag t-gray">Inactive</span>';
      const initials = card.name.split(' ').map(n => n[0]).join('').substring(0, 2);
      
      cardEl.innerHTML = `
        <div class="staff-card-header">
          <div class="staff-card-avatar">${initials}</div>
          ${statusTag}
        </div>
        <div class="staff-card-body">
          <div class="staff-card-name">${card.name}</div>
          <div class="staff-card-id">ID: ${card.card_id}</div>
          <div class="staff-card-dept"><i class="fa-solid fa-building"></i> ${card.department}</div>
        </div>
        <div class="staff-card-actions">
          <button class="btn btn-secondary" onclick="openEditCardModal('${card.card_id}', '${card.name.replace(/'/g, "\\'")}', '${card.department}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          ${card.active ? 
            `<button class="btn btn-danger" onclick="deactivateCard('${card.card_id}')"><i class="fa-solid fa-ban"></i> Block</button>` : 
            `<button class="btn btn-primary" style="background-color: var(--color-success);" onclick="registerExistingCard('${card.card_id}', '${card.name.replace(/'/g, "\\'")}', '${card.department}')"><i class="fa-solid fa-check"></i> Activate</button>`
          }
        </div>
      `;
      cardsGrid.appendChild(cardEl);
    });
  } catch (err) {
    console.error(err);
  }
}

// Fetch raw scans
async function loadRawScans() {
  try {
    const filterType = document.getElementById('scan-filter-type').value;
    const filterDept = document.getElementById('scan-filter-dept').value;
    const from = document.getElementById('scan-filter-from').value || '2026-05-01';
    const to = document.getElementById('scan-filter-to').value || '2026-05-31';
    
    let url = `${API_BASE}/attendance?from=${from}&to=${to}&per_page=100`;
    if (filterType) url += `&scan_type=${filterType}`;
    if (filterDept) url += `&department=${filterDept}`;
    
    const res = await fetch(url, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const tbody = document.getElementById('raw-scans-table-body');
    tbody.innerHTML = '';
    
    const searchQuery = (document.getElementById('scan-filter-search').value || '').toLowerCase();
    let records = data.records || [];
    if (searchQuery) {
      records = records.filter(scan => 
        scan.name.toLowerCase().includes(searchQuery) || 
        scan.card_id.toLowerCase().includes(searchQuery)
      );
    }
    
    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-text-secondary);">No matching scan records found.</td></tr>`;
      return;
    }
    
    records.forEach(scan => {
      const tr = document.createElement('tr');
      const scanTypeTag = getScanTypeTag(scan.scan_type);
      const isLateTag = scan.is_late ? '<span class="tag t-red">LATE</span>' : '<span class="tag t-gray">ON TIME</span>';
      
      let outInfo = '-';
      if (scan.scan_type === 'morning_in') {
        if (scan.out_time) {
          outInfo = `Out: ${scan.out_time} (${scan.duration_minutes} min)`;
        } else {
          outInfo = '<span style="color:var(--color-warning);">No Exit Tap</span>';
        }
      }
      
      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-size:0.75rem;">${scan.id}</td>
        <td style="font-family: var(--font-mono); font-size:0.75rem;">${scan.card_id}</td>
        <td style="font-weight: 600;">${scan.name}</td>
        <td>${scan.department}</td>
        <td>${scan.session || 'Morning'}</td>
        <td>${scan.scan_time}</td>
        <td>${scanTypeTag}</td>
        <td>${isLateTag}</td>
        <td style="font-size:0.75rem;">${outInfo}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// Generate stats reports
async function generateReport() {
  const from = document.getElementById('report-from-date').value;
  const to = document.getElementById('report-to-date').value;
  
  if (!from || !to) {
    alert('Please select date parameters!');
    return;
  }
  
  document.getElementById('report-summary-view').style.display = 'block';
  document.getElementById('report-absent-view').style.display = 'none';
  document.getElementById('report-title-text').textContent = `Attendance Summary: ${from} to ${to}`;
  document.getElementById('btn-export-excel').style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/attendance/summary?from=${from}&to=${to}`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    // Save report data for Excel exporter & search filter
    currentReportData = data.summary;
    currentReportRange = { from, to };
    
    // Render report list dynamically with active filters
    filterReportTable();
    
    document.getElementById('btn-export-excel').style.display = 'inline-flex';
  } catch (err) {
    console.error(err);
  }
}

// Generate absent list
async function generateAbsentList() {
  const dateVal = document.getElementById('report-from-date').value;
  if (!dateVal) {
    alert('Please specify a date in the From Date field!');
    return;
  }
  
  document.getElementById('report-summary-view').style.display = 'none';
  document.getElementById('report-absent-view').style.display = 'block';
  document.getElementById('absent-title-text').textContent = `Absentees & Late Arrivals: ${dateVal}`;
  document.getElementById('btn-export-excel').style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/attendance/absent?date=${dateVal}`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    const absentTbody = document.getElementById('report-absent-table-body');
    absentTbody.innerHTML = '';
    document.getElementById('absent-count').textContent = data.absent_count;
    
    if (data.absent.length === 0) {
      absentTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--color-text-secondary);">Nobody absent! 🎉</td></tr>`;
    } else {
      data.absent.forEach(staff => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: var(--font-mono);">${staff.card_id}</td>
          <td style="font-weight:600;">${staff.name}</td>
          <td>${staff.department}</td>
        `;
        absentTbody.appendChild(tr);
      });
    }
    
    const lateTbody = document.getElementById('report-late-table-body');
    lateTbody.innerHTML = '';
    document.getElementById('late-count').textContent = data.late_count;
    
    if (data.late.length === 0) {
      lateTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--color-text-secondary);">No lates.</td></tr>`;
    } else {
      data.late.forEach(staff => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: var(--font-mono);">${staff.card_id}</td>
          <td style="font-weight:600;">${staff.name}</td>
          <td style="color:var(--color-danger); font-family:var(--font-mono);">${staff.scan_time}</td>
        `;
        lateTbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Export summary reports to Excel compatible CSV
function exportReportToExcel() {
  if (!currentReportData || currentReportData.length === 0 || !currentReportRange) {
    alert('No report data available to export! Please calculate stats first.');
    return;
  }
  
  const schoolName = sessionStorage.getItem('wlyl_school_name') || 'School';
  const from = currentReportRange.from;
  const to = currentReportRange.to;
  
  const searchQuery = (document.getElementById('report-filter-search').value || '').toLowerCase();
  let dataToExport = currentReportData;
  if (searchQuery) {
    dataToExport = currentReportData.filter(sum => 
      sum.name.toLowerCase().includes(searchQuery) || 
      sum.card_id.toLowerCase().includes(searchQuery)
    );
  }
  
  const headers = [
    'Card ID',
    'Teacher Name',
    'Department',
    'Days Present',
    'Days Absent',
    'Late Arrivals',
    'Half Days',
    'Avg Duration (Minutes)'
  ];
  
  const rows = dataToExport.map(sum => [
    `"${sum.card_id}"`,
    `"${sum.name}"`,
    `"${sum.department}"`,
    sum.present,
    sum.absent,
    sum.late,
    sum.half_day,
    sum.avg_duration
  ]);
  
  const BOM = "\uFEFF"; // Byte Order Mark for Excel encoding
  const csvContent = BOM + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const sanitizedSchool = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.setAttribute('href', url);
  link.setAttribute('download', `wlyl_attendance_summary_${sanitizedSchool}_${from}_to_${to}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logTerminal(`Exported attendance summary report to Excel sheet: ${sanitizedSchool}_${from}_to_${to}.csv`, 'success');
}

// Load Licence Info
async function loadLicenceInfo() {
  const schoolId = sessionStorage.getItem('wlyl_school_id');
  if (!schoolId) return;

  try {
    const res = await fetch(`${API_BASE}/ping`, { headers: getSessionHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    // Find active school details from simulator school list
    const school = terminalSchools.find(s => s.school_id === schoolId);
    if (!school) return;
    
    // Call server to fetch full license profiles (since we are authenticated as this school admin)
    // We can lookup full stats by getting the licence details box
    // Let's call /v1/admin/schools (it's super-admin only, but school admins get details from ping or dedicated settings)
    
    // Since we need to show license status, let's fetch events log
    const eventRes = await fetch(`${API_BASE}/licence/event-logs`, { headers: getSessionHeaders() });
    if (eventRes.ok) {
      const eventData = await eventRes.json();
      const tbody = document.getElementById('licence-events-table-body');
      tbody.innerHTML = '';
      
      if (eventData.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-secondary);">No events log recorded.</td></tr>`;
      } else {
        eventData.logs.forEach(log => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong style="color:var(--color-primary);">${log.event}</strong></td>
            <td><code>${log.machine_id || MACHINE_ID}</code></td>
            <td><span class="tag t-green">${log.days_left} days left</span></td>
            <td><code>${log.app_version || '1.0'}</code></td>
            <td style="font-family:var(--font-mono); font-size:0.75rem;">${log.server_timestamp}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Retrieve and show school specific licence values
    // We'll query details using school attributes or ping variables
    // Since details are pre-loaded in DB, let's get the active info
    document.getElementById('licence-school-name').textContent = data.school_name;
    document.getElementById('licence-key-val').textContent = school.api_key; // using api key as token mask
    document.getElementById('licence-id-val').textContent = 'LC-' + schoolId.replace('SCH', '00');
    document.getElementById('licence-machine-id').textContent = MACHINE_ID;
    
    // Auto-fill activation form school name
    const actSchoolInput = document.getElementById('act-school');
    if (actSchoolInput && !actSchoolInput.value) {
      actSchoolInput.value = data.school_name;
    }
    
    // Let's set placeholders or lookup variables
    document.getElementById('licence-issued').textContent = '2026-05-25';
    document.getElementById('licence-expires').textContent = '2027-05-25';
    document.getElementById('licence-days-left').textContent = '364';
    
  } catch (err) {
    console.error(err);
  }
}

// Activate Licence Scoped
async function activateLicence() {
  const licence_key = document.getElementById('act-key').value.trim();
  const school_name = document.getElementById('act-school').value.trim();
  const machine_id = document.getElementById('act-machine').value.trim();
  
  if (!licence_key || !school_name || !machine_id) {
    showToast('Please enter all activation fields!', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/licence/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licence_key, school_name, machine_id })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Licence Key Activated Successfully! School ID: ${data.school_id}`, 'success');
      
      // Send Licence Activated Event
      await fetch(`${API_BASE}/licence/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.api_key}`
        },
        body: JSON.stringify({
          event: 'licence_activated',
          licence_id: data.licence_id,
          school: school_name,
          machine_id: machine_id,
          expires: data.expires,
          days_left: 365,
          app_version: '1.0',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        })
      });

      // Reload school list so selector binds new API key
      await loadTerminalSchools();
      
      document.getElementById('act-key').value = '';
      document.getElementById('act-school').value = '';
      
      checkSchoolActiveStatus();
      refreshDashboard();
      loadLicenceInfo();
    } else {
      showToast(`Activation Failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast('Failed to connect to API server.', 'error');
  }
}

// Reset Database utility
async function resetDatabase() {
  if (!confirm('Are you sure you want to clear and reset the Cloud database? All custom scans and cards will be lost.')) return;
  
  try {
    const res = await fetch('/admin/reset', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      // Clear localStorage queues
      localStorage.clear();
      initLocalStorage();
      showToast('Cloud and Local database partitions reset successfully!', 'success');
      handleLogout();
    }
  } catch (err) {
    showToast('Reset failed.', 'error');
  }
}

function initLocalStorage() {
  if (activeTerminalSchool) {
    initLocalDbForSchool(activeTerminalSchool.school_id);
  }
}

// --- STAFF CARD DIALOG MANAGEMENT ---

function openRegisterCardModal() {
  document.getElementById('reg-card-id').value = '';
  document.getElementById('reg-card-name').value = '';
  document.getElementById('reg-card-dept').value = 'Teaching';
  document.getElementById('register-card-modal').classList.add('active');
}

function closeRegisterCardModal() {
  document.getElementById('register-card-modal').classList.remove('active');
}

async function submitRegisterCard() {
  const card_id = document.getElementById('reg-card-id').value.trim();
  const name = document.getElementById('reg-card-name').value.trim();
  const department = document.getElementById('reg-card-dept').value;
  
  if (!card_id || !name) {
    showToast('Please enter card ID and name!', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/cards`, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify({ card_id, name, department })
    });
    
    const data = await res.json();
    if (res.status === 201) {
      showToast('Card registered successfully!', 'success');
      closeRegisterCardModal();
      loadCards();
      
      // Reload terminal cards dropdown if simulating this school
      if (activeTerminalSchool && activeTerminalSchool.school_id === sessionStorage.getItem('wlyl_school_id')) {
        loadTerminalCards(activeTerminalSchool);
      }
    } else {
      showToast(`Registration Failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast('Failed to connect to API server.', 'error');
  }
}

async function registerExistingCard(card_id, name, department) {
  try {
    const res = await fetch(`${API_BASE}/cards`, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify({ card_id, name, department })
    });
    
    if (res.ok) {
      loadCards();
      if (activeTerminalSchool && activeTerminalSchool.school_id === sessionStorage.getItem('wlyl_school_id')) {
        loadTerminalCards(activeTerminalSchool);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function deactivateCard(cardId) {
  if (!confirm(`Are you sure you want to block Card ID: ${cardId}?`)) return;
  
  try {
    const res = await fetch(`${API_BASE}/cards/${cardId}`, {
      method: 'DELETE',
      headers: getSessionHeaders()
    });
    
    if (res.ok) {
      showToast('Card blocked successfully!', 'success');
      loadCards();
      if (activeTerminalSchool && activeTerminalSchool.school_id === sessionStorage.getItem('wlyl_school_id')) {
        loadTerminalCards(activeTerminalSchool);
      }
    } else {
      showToast('Failed to deactivate card.', 'error');
    }
  } catch (err) {
    showToast('Error deactivating card.', 'error');
  }
}

function openEditCardModal(cardId, name, department) {
  document.getElementById('edit-card-id').value = cardId;
  document.getElementById('edit-card-id-display').value = cardId;
  document.getElementById('edit-card-name').value = name;
  document.getElementById('edit-card-dept').value = department;
  
  document.getElementById('edit-card-modal').classList.add('active');
}

function closeEditCardModal() {
  document.getElementById('edit-card-modal').classList.remove('active');
}

async function submitEditCard() {
  const cardId = document.getElementById('edit-card-id').value;
  const name = document.getElementById('edit-card-name').value.trim();
  const department = document.getElementById('edit-card-dept').value;
  
  if (!name) {
    showToast('Name cannot be blank!', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/cards/${cardId}`, {
      method: 'PUT',
      headers: getSessionHeaders(),
      body: JSON.stringify({ name, department })
    });
    
    if (res.ok) {
      showToast('Card updated successfully!', 'success');
      closeEditCardModal();
      loadCards();
      if (activeTerminalSchool && activeTerminalSchool.school_id === sessionStorage.getItem('wlyl_school_id')) {
        loadTerminalCards(activeTerminalSchool);
      }
    } else {
      showToast('Failed to update card.', 'error');
    }
  } catch (err) {
    showToast('Error updating card.', 'error');
  }
}

// Helper: Generate CSS badges for different scan types
function getScanTypeTag(type) {
  switch (type) {
    case 'morning_in':
      return '<span class="tag t-green">morning_in</span>';
    case 'afternoon_in':
      return '<span class="tag t-blue">afternoon_in</span>';
    case 'out':
      return '<span class="tag t-amber">out</span>';
    case 'in':
      return '<span class="tag t-gray">in</span>';
    default:
      return `<span class="tag t-gray">${type}</span>`;
  }
}

// Open detailed day-by-day attendance modal for a teacher
async function viewTeacherDailyAttendance(cardId, name) {
  const from = document.getElementById('report-from-date').value;
  const to = document.getElementById('report-to-date').value;
  
  if (!from || !to) {
    alert('Please specify a date range in the Reports section!');
    return;
  }
  
  // Set basic modal details
  document.getElementById('teacher-details-title').textContent = `Daily Attendance Sheet: ${name}`;
  document.getElementById('details-teacher-id').textContent = cardId;
  document.getElementById('details-date-range').textContent = `${from} to ${to}`;
  
  const tbody = document.getElementById('teacher-details-table-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary);">Retrieving daily records...</td></tr>';
  
  // Open modal
  document.getElementById('teacher-details-modal').classList.add('active');
  
  try {
    const res = await fetch(`${API_BASE}/attendance?from=${from}&to=${to}&card_id=${cardId}&per_page=1000`, { headers: getSessionHeaders() });
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-danger);">Failed to load attendance records.</td></tr>';
      return;
    }
    const data = await res.json();
    const records = data.records || [];
    
    // Sort records chronologically (ascending)
    records.sort((a, b) => a.scan_time.localeCompare(b.scan_time));
    
    // Generate all dates in the range (noon timestamps to avoid DST shift issues)
    const dates = [];
    let currStr = from;
    while (currStr <= to) {
      dates.push(currStr);
      let d = new Date(currStr + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      currStr = d.toISOString().split('T')[0];
    }
    
    tbody.innerHTML = '';
    
    if (dates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary);">No days in range.</td></tr>';
      return;
    }
    
    dates.forEach(date => {
      // Filter records for this day
      const dayScans = records.filter(r => r.scan_time.startsWith(date));
      
      const dateObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // 0 = Sunday, 6 = Saturday
      
      // Identify morning_in, afternoon_in, and out scans
      const morningIn = dayScans.find(s => s.scan_type === 'morning_in');
      const afternoonIn = dayScans.find(s => s.scan_type === 'afternoon_in');
      const outTap = dayScans.find(s => s.scan_type === 'out');
      
      // Fallback check-out time from morningIn.out_time
      const outTime = outTap ? outTap.scan_time.split(' ')[1] : (morningIn && morningIn.out_time ? morningIn.out_time : '');
      
      let statusTag = '';
      let morningInCell = '-';
      let afternoonInCell = '-';
      let outCell = '-';
      let durationCell = '-';
      
      if (dayScans.length === 0) {
        if (isWeekend) {
          statusTag = '<span class="tag t-gray">Weekend</span>';
        } else {
          statusTag = '<span class="tag t-red" style="font-weight:700;">Absent</span>';
        }
      } else {
        // Worked
        if (morningIn) {
          const morningInTime = morningIn.scan_time.split(' ')[1];
          if (morningIn.is_late) {
            morningInCell = `<strong style="font-family: var(--font-mono);">${morningInTime}</strong> <span class="tag t-red" style="font-size: 0.65rem; padding: 1px 4px;">LATE</span>`;
          } else {
            morningInCell = `<span style="font-family: var(--font-mono);">${morningInTime}</span>`;
          }
        }
        
        if (afternoonIn) {
          afternoonInCell = `<span style="font-family: var(--font-mono);">${afternoonIn.scan_time.split(' ')[1]}</span>`;
        }
        
        if (outTime) {
          outCell = `<span style="font-family: var(--font-mono);">${outTime}</span>`;
        } else {
          outCell = '<span style="color: var(--color-warning); font-size: 0.75rem;">No Exit Tap</span>';
        }
        
        // Duration
        let durationMin = 0;
        if (morningIn && morningIn.duration_minutes > 0) {
          durationMin = morningIn.duration_minutes;
        } else if (morningIn && outTime) {
          const entryParts = morningIn.scan_time.split(' ')[1].split(':');
          const exitParts = outTime.split(':');
          const entryMin = parseInt(entryParts[0]) * 60 + parseInt(entryParts[1]);
          const exitMin = parseInt(exitParts[0]) * 60 + parseInt(exitParts[1]);
          durationMin = Math.max(0, exitMin - entryMin);
        }
        
        if (durationMin > 0) {
          const hrs = Math.floor(durationMin / 60);
          const mins = durationMin % 60;
          durationCell = `<strong style="font-family: var(--font-mono);">${hrs}h ${mins}m</strong> (${durationMin} min)`;
        }
        
        // Status Tag
        if (morningIn && outTime) {
          statusTag = '<span class="tag t-green" style="font-weight:700;">Present</span>';
        } else {
          statusTag = '<span class="tag t-gray" style="border-color: var(--color-warning); color: var(--color-warning);">Half Day</span>';
        }
      }
      
      const tr = document.createElement('tr');
      if (dayScans.length === 0 && isWeekend) {
        tr.style.opacity = '0.6';
      }
      
      tr.innerHTML = `
        <td style="font-weight: 500;">${date} <span style="font-size:0.7rem; color:var(--color-text-secondary); font-weight:normal;">(${dateObj.toLocaleDateString('en-US', {weekday: 'short'})})</span></td>
        <td>${statusTag}</td>
        <td>${morningInCell}</td>
        <td>${afternoonInCell}</td>
        <td>${outCell}</td>
        <td>${durationCell}</td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-danger);">Error fetching daily attendance data.</td></tr>';
  }
}

// Close detailed modal
function closeTeacherDetailsModal() {
  document.getElementById('teacher-details-modal').classList.remove('active');
}

// Preset helpers to avoid manual date entry
function setReportPreset(preset) {
  const fromInput = document.getElementById('report-from-date');
  const toInput = document.getElementById('report-to-date');
  if (!fromInput || !toInput) return;
  
  const now = new Date();
  if (preset === 'this-month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fromInput.value = getLocalDateString(firstDay);
    toInput.value = getLocalDateString(lastDay);
  } else if (preset === 'today') {
    const todayStr = getLocalDateString(now);
    fromInput.value = todayStr;
    toInput.value = todayStr;
  }
  generateReport();
}

function setScanPreset(preset) {
  const fromInput = document.getElementById('scan-filter-from');
  const toInput = document.getElementById('scan-filter-to');
  if (!fromInput || !toInput) return;
  
  const now = new Date();
  if (preset === 'this-month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fromInput.value = getLocalDateString(firstDay);
    toInput.value = getLocalDateString(lastDay);
  } else if (preset === 'today') {
    const todayStr = getLocalDateString(now);
    fromInput.value = todayStr;
    toInput.value = todayStr;
  }
  loadRawScans();
}

// Client-side search filtering for reports table
function filterReportTable() {
  const searchQuery = (document.getElementById('report-filter-search').value || '').toLowerCase();
  const tbody = document.getElementById('report-summary-table-body');
  tbody.innerHTML = '';
  
  if (!currentReportData || currentReportData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-text-secondary);">Select a date range and click Calculate Stats.</td></tr>';
    return;
  }
  
  const filtered = currentReportData.filter(sum => 
    sum.name.toLowerCase().includes(searchQuery) || 
    sum.card_id.toLowerCase().includes(searchQuery)
  );
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-text-secondary);">No matching staff found.</td></tr>';
    return;
  }
  
  filtered.forEach(sum => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.title = `Click to view detailed daily attendance sheet for ${sum.name}`;
    tr.onclick = () => viewTeacherDailyAttendance(sum.card_id, sum.name);
    tr.innerHTML = `
      <td style="font-family: var(--font-mono);">${sum.card_id}</td>
      <td style="font-weight: 600; color: var(--color-primary); text-decoration: underline;">${sum.name}</td>
      <td>${sum.department}</td>
      <td><span class="tag t-green" style="font-weight:700;">${sum.present} days</span></td>
      <td><span class="tag t-red" style="font-weight:700;">${sum.absent} days</span></td>
      <td><span class="tag t-amber">${sum.late} scans</span></td>
      <td><span class="tag t-gray">${sum.half_day} days</span></td>
      <td style="font-family: var(--font-mono); font-weight: 600;">${sum.avg_duration ? `${sum.avg_duration} mins` : '-'}</td>
    `;
  });
}

// Establish real-time SSE stream channel connection
let sseSource = null;

function connectSSE() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
  
  const token = sessionStorage.getItem('wlyl_token');
  if (!token) return;
  
  sseSource = new EventSource(`${API_BASE}/events?token=${token}`);
  
  sseSource.addEventListener('new-scan', (e) => {
    try {
      const record = JSON.parse(e.data);
      logTerminal(`[Real-time API Event] Tap recorded for staff: ${record.name} (${record.card_id})`, 'success');
      handleIncomingRealtimeScan(record);
    } catch (err) {
      console.error('Error parsing SSE event payload:', err);
    }
  });
  
  sseSource.onerror = (err) => {
    console.warn('SSE connection lost. Reconnecting...');
  };
}

// Reactively reload active views when a new swipe event arrives
function handleIncomingRealtimeScan(record) {
  const overviewActive = document.getElementById('overview').classList.contains('active');
  const logsActive = document.getElementById('scan-events').classList.contains('active');
  const reportsActive = document.getElementById('reports-mgmt').classList.contains('active');
  
  if (overviewActive) {
    refreshDashboard();
  } else if (logsActive) {
    loadRawScans();
  } else if (reportsActive) {
    const fromVal = document.getElementById('report-from-date').value;
    const toVal = document.getElementById('report-to-date').value;
    if (fromVal && toVal && currentReportRange) {
      generateReport();
    }
  }
}
