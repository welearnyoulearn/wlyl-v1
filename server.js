const express = require('express');
const path = require('path');
const fs = require('fs');

// Initialize Supabase Client
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bxinssdjwuzfjexhzzqi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aW5zc2Rqd3V6ZmpleGh6enFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODkxOTAwOSwiZXhwIjoyMDk0NDk1MDA5fQ._jR6xEpvWUseh6XSjkZ3vqbAzwOAOUVyjMPUq3bWhak';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File paths for persistence
const CLOUD_DB_PATH = path.join(__dirname, 'database_cloud.json');

// Initialize database in memory
let db = {
  super_admin: {
    username: 'admin',
    password: 'admin',
    token: 'super_admin_token'
  },
  schools: [
    {
      school_id: 'SCH001',
      school_name: 'ABC School Hyderabad',
      username: 'school1',
      password: 'school1',
      api_key: 'wlyl_sk_A1B2C3D4E5F6',
      licence_id: 'LC-0042',
      licence_key: 'WLYL-A3F2-K9P1-M7X4-B2Q8',
      machine_id: 'A1B2C3D4',
      issued: '2026-05-25',
      expires: '2027-05-25',
      days_left: 364,
      active: true,
      subscription_start: '2026-05-25',
      subscription_expire: '2027-05-25',
      amount_paid: 15000
    },
    {
      school_id: 'SCH002',
      school_name: 'Oakridge International',
      username: 'school2',
      password: 'school2',
      api_key: 'wlyl_sk_B2C3D4E5F6G7',
      licence_id: 'LC-0043',
      licence_key: 'WLYL-B3F2-L9P1-N7X4-C2Q8',
      machine_id: 'B2C3D4E5',
      issued: '2026-05-25',
      expires: '2027-05-25',
      days_left: 364,
      active: true,
      subscription_start: '2026-05-20',
      subscription_expire: '2027-05-20',
      amount_paid: 18000
    }
  ],
  cards: [
    // School 1 (ABC School)
    { card_id: '1001001001', school_id: 'SCH001', name: 'Ravi Kumar', department: 'Teaching', active: true, created_at: '2026-04-01 09:00:00' },
    { card_id: '1001001002', school_id: 'SCH001', name: 'Priya Sharma', department: 'Teaching', active: true, created_at: '2026-04-01 09:15:00' },
    { card_id: '1001001003', school_id: 'SCH001', name: 'Krishna Reddy', department: 'Admin', active: true, created_at: '2026-04-02 08:30:00' },
    { card_id: '1001001004', school_id: 'SCH001', name: 'Suresh Goud', department: 'Support', active: true, created_at: '2026-04-03 10:00:00' },
    // School 2 (Oakridge)
    { card_id: '1001001005', school_id: 'SCH002', name: 'Venkat Rao', department: 'Admin', active: true, created_at: '2026-04-05 09:00:00' },
    { card_id: '1001001006', school_id: 'SCH002', name: 'Kalyani Sen', department: 'Teaching', active: true, created_at: '2026-04-10 09:00:00' }
  ],
  scans: [],
  licence_events: []
};

// Seed historical attendance data for May 2026 up to May 26 for all schools
function seedData() {
  const scans = [];
  const cards = db.cards;
  const totalDays = 26; // up to May 26

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `2026-05-${day.toString().padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Saturday and Sunday

    cards.forEach((card) => {
      // 90% attendance probability
      if (Math.random() > 0.9 && card.card_id !== '1001001001') return;

      // Determine scans for the day
      let isLate = false;
      let checkInTime = '08:45:00';

      if (card.card_id === '1001001004' && Math.random() > 0.4) {
        isLate = true;
        checkInTime = `09:18:00`;
      } else if (card.card_id === '1001001006' && Math.random() > 0.6) {
        isLate = true;
        checkInTime = `09:07:00`;
      } else {
        checkInTime = `08:${Math.floor(Math.random() * 20 + 30).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
      }

      // morning_in
      const scanTimeStr = `${dateStr} ${checkInTime}`;
      scans.push({
        id: `REC_${dateStr.replace(/-/g, '')}_${card.card_id}_1`,
        school_id: card.school_id,
        card_id: card.card_id,
        name: card.name,
        department: card.department,
        session: 'Morning',
        scan_time: scanTimeStr,
        scan_type: 'morning_in',
        is_late: isLate,
        out_time: '',
        duration_minutes: 0,
        scan_mode: 'IN_IN_OUT',
        entry_point: 'Main Gate'
      });

      // afternoon_in (only 80% do it)
      const afterNoonCheckIn = `13:${Math.floor(Math.random() * 15).toString().padStart(2, '0')}:00`;
      scans.push({
        id: `REC_${dateStr.replace(/-/g, '')}_${card.card_id}_2`,
        school_id: card.school_id,
        card_id: card.card_id,
        name: card.name,
        department: card.department,
        session: 'Afternoon',
        scan_time: `${dateStr} ${afterNoonCheckIn}`,
        scan_type: 'afternoon_in',
        is_late: false,
        out_time: '',
        duration_minutes: 0,
        scan_mode: 'IN_IN_OUT',
        entry_point: 'Main Gate'
      });

      // out scan (some might forget, say 95% do it)
      if (Math.random() < 0.95) {
        const outTime = `17:${Math.floor(Math.random() * 30 + 10).toString().padStart(2, '0')}:00`;
        const entryHour = parseInt(checkInTime.split(':')[0]);
        const entryMin = parseInt(checkInTime.split(':')[1]);
        const exitHour = parseInt(outTime.split(':')[0]);
        const exitMin = parseInt(outTime.split(':')[1]);
        const duration = (exitHour * 60 + exitMin) - (entryHour * 60 + entryMin);

        // Update the morning_in record with the exit time and duration
        const lastScan = scans[scans.length - 2];
        if (lastScan) {
          lastScan.out_time = outTime;
          lastScan.duration_minutes = duration;
        }

        scans.push({
          id: `REC_${dateStr.replace(/-/g, '')}_${card.card_id}_3`,
          school_id: card.school_id,
          card_id: card.card_id,
          name: card.name,
          department: card.department,
          session: 'Afternoon',
          scan_time: `${dateStr} ${outTime}`,
          scan_type: 'out',
          is_late: false,
          out_time: '',
          duration_minutes: 0,
          scan_mode: 'IN_IN_OUT',
          entry_point: 'Main Gate'
        });
      }
    });
  }

  db.scans = scans;
}

// Load database from Supabase at startup with local file fallback
async function loadDb() {
  try {
    const [adminRes, schoolsRes, cardsRes, scansRes, eventsRes] = await Promise.all([
      supabase.from('super_admin').select('*'),
      supabase.from('schools').select('*'),
      supabase.from('cards').select('*'),
      supabase.from('scans').select('*'),
      supabase.from('licence_events').select('*')
    ]);

    if (adminRes.error || schoolsRes.error || cardsRes.error || scansRes.error || eventsRes.error) {
      throw new Error('Supabase query error: ' + (adminRes.error?.message || schoolsRes.error?.message || cardsRes.error?.message || scansRes.error?.message || eventsRes.error?.message));
    }

    if (adminRes.data && adminRes.data.length > 0) {
      db.super_admin = {
        username: adminRes.data[0].username,
        password: adminRes.data[0].password,
        token: adminRes.data[0].token
      };
      db.schools = schoolsRes.data || [];
      db.cards = cardsRes.data || [];
      db.scans = scansRes.data || [];
      db.licence_events = eventsRes.data || [];
      console.log('Successfully loaded database from Supabase.');
      // Update local file backup
      try {
        fs.writeFileSync(CLOUD_DB_PATH, JSON.stringify(db, null, 2));
      } catch (e) {
        console.error('Backup write failed:', e);
      }
    } else {
      console.log('Supabase is empty. Seeding database with initial default data...');
      if (fs.existsSync(CLOUD_DB_PATH)) {
        db = JSON.parse(fs.readFileSync(CLOUD_DB_PATH, 'utf8'));
      } else {
        seedData();
      }
      await saveDb();
    }
  } catch (err) {
    console.error('Failed to load from Supabase. Falling back to local JSON database backup...', err.message);
    if (fs.existsSync(CLOUD_DB_PATH)) {
      try {
        db = JSON.parse(fs.readFileSync(CLOUD_DB_PATH, 'utf8'));
        console.log('Loaded backup database from local JSON file.');
      } catch (jsonErr) {
        console.error('Error reading backup file. Re-initializing...', jsonErr);
        seedData();
        fs.writeFileSync(CLOUD_DB_PATH, JSON.stringify(db, null, 2));
      }
    } else {
      console.log('No local database backup found. Seeding default data...');
      seedData();
      fs.writeFileSync(CLOUD_DB_PATH, JSON.stringify(db, null, 2));
    }
  }
}

// Clear all Supabase tables (used during hard database reset)
async function clearSupabaseDb() {
  try {
    await Promise.all([
      supabase.from('scans').delete().neq('id', ''),
      supabase.from('licence_events').delete().neq('id', ''),
      supabase.from('cards').delete().neq('card_id', ''),
      supabase.from('schools').delete().neq('school_id', ''),
      supabase.from('super_admin').delete().neq('id', 0)
    ]);
    console.log('Cleared all tables in Supabase.');
  } catch (err) {
    console.error('Error clearing Supabase tables:', err.message);
  }
}

// Server-Sent Events client registry
let sseClients = [];

// Helper to broadcast a scan event
function broadcastScanEvent(schoolId, record) {
  sseClients.forEach(client => {
    if (client.is_super || client.school_id === schoolId) {
      try {
        client.res.write(`event: new-scan\n`);
        client.res.write(`data: ${JSON.stringify(record)}\n\n`);
      } catch (err) {
        console.error('Failed to write SSE packet to client:', err);
      }
    }
  });
}

async function saveDb() {
  // 1. Write locally as fallback
  try {
    fs.writeFileSync(CLOUD_DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Local backup write failed:', e);
  }

  // 2. Write to Supabase asynchronously
  try {
    const adminObj = {
      id: 1,
      username: db.super_admin.username,
      password: db.super_admin.password,
      token: db.super_admin.token
    };

    const promises = [
      supabase.from('super_admin').upsert([adminObj])
    ];

    if (db.schools && db.schools.length > 0) {
      promises.push(supabase.from('schools').upsert(db.schools));
    }
    if (db.cards && db.cards.length > 0) {
      promises.push(supabase.from('cards').upsert(db.cards));
    }
    if (db.scans && db.scans.length > 0) {
      promises.push(supabase.from('scans').upsert(db.scans));
    }
    if (db.licence_events && db.licence_events.length > 0) {
      promises.push(supabase.from('licence_events').upsert(db.licence_events));
    }

    const results = await Promise.all(promises);
    
    // Check if any errors occurred
    results.forEach((res, index) => {
      if (res.error) {
        console.error(`Error syncing table index ${index} to Supabase:`, res.error.message);
      }
    });
  } catch (err) {
    console.error('Supabase background sync error:', err.message);
  }
}

// Rate Limiting Mock State
let rateLimits = {
  remaining: 1000,
  resetTime: Date.now() + 3600000
};

// Middleware: API Auth and Tenant Identification
function apiMiddleware(req, res, next) {
  // Set rate limit headers
  if (Date.now() > rateLimits.resetTime) {
    rateLimits.remaining = 1000;
    rateLimits.resetTime = Date.now() + 3600000;
  }
  rateLimits.remaining = Math.max(0, rateLimits.remaining - 1);

  res.setHeader('X-RateLimit-Limit', '1000');
  res.setHeader('X-RateLimit-Remaining', rateLimits.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(rateLimits.resetTime / 1000).toString());
  res.setHeader('X-API-Version', 'v1');

  // Paths exempt from authentication
  const exemptPaths = ['/auth/login', '/licence/activate', '/ping', '/schools/public', '/v1/auth/login', '/v1/licence/activate', '/v1/ping', '/v1/schools/public', '/v1/events', '/events'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Missing credentials',
      code: 401
    });
  }

  const token = authHeader.split(' ')[1];

  // 1. Check Super Admin Session Token
  if (token === db.super_admin.token) {
    req.is_super = true;
    return next();
  }

  // 2. Check School Admin Session Token (school_token_<school_id>)
  if (token.startsWith('school_token_')) {
    const schoolId = token.substring('school_token_'.length);
    const school = db.schools.find(s => s.school_id === schoolId);
    if (school) {
      if (!school.active) {
        return res.status(403).json({
          success: false,
          error: 'forbidden',
          message: 'School licence is currently inactive or locked',
          code: 403
        });
      }
      req.school_id = schoolId;
      return next();
    }
  }

  // 3. Check School Hardware API Key (wlyl_sk_...)
  const school = db.schools.find(s => s.api_key === token);
  if (school) {
    if (!school.active) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'School licence is currently inactive or locked',
        code: 403
      });
    }
    req.school_id = school.school_id;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'unauthorized',
    message: 'Invalid authorization token',
    code: 401
  });
}

// Apply API Middleware to all v1 endpoints
app.use('/v1', apiMiddleware);

// --- AUTH & LOGIN ---
app.post('/v1/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'bad_request', message: 'Missing credentials' });
  }

  // Super Admin Check
  if (username === db.super_admin.username && password === db.super_admin.password) {
    return res.json({
      success: true,
      role: 'super',
      token: db.super_admin.token
    });
  }

  // School Admin Check
  const school = db.schools.find(s => s.username === username && s.password === password);
  if (school) {
    return res.json({
      success: true,
      role: 'school',
      school_id: school.school_id,
      school_name: school.school_name,
      token: `school_token_${school.school_id}`
    });
  }

  return res.status(401).json({
    success: false,
    error: 'unauthorized',
    message: 'Invalid username or password'
  });
});

// --- SUPER ADMIN MANAGEMENT ENDPOINTS ---

// GET /v1/admin/schools - Fetch all schools
app.get('/v1/admin/schools', (req, res) => {
  if (!req.is_super) {
    return res.status(403).json({ success: false, error: 'forbidden', message: 'Super admin access required' });
  }

  // Add stats to each school profile
  const schoolsWithStats = db.schools.map(school => {
    const cardCount = db.cards.filter(c => c.school_id === school.school_id && c.active).length;
    const scanCount = db.scans.filter(s => s.school_id === school.school_id).length;
    return {
      ...school,
      card_count: cardCount,
      scan_count: scanCount
    };
  });

  res.json({
    success: true,
    schools: schoolsWithStats
  });
});

// POST /v1/admin/schools - Register a new school
app.post('/v1/admin/schools', (req, res) => {
  if (!req.is_super) {
    return res.status(403).json({ success: false, error: 'forbidden', message: 'Super admin access required' });
  }

  const { school_name, username, password, subscription_start, subscription_expire, amount_paid } = req.body;

  if (!school_name || !username || !password) {
    return res.status(400).json({ success: false, error: 'bad_request', message: 'Missing school details' });
  }

  // Duplicate username checks
  if (username === 'admin' || db.schools.some(s => s.username === username)) {
    return res.status(409).json({ success: false, error: 'conflict', message: 'Username is already in use' });
  }

  const newSchoolId = `SCH${(db.schools.length + 1).toString().padStart(3, '0')}`;
  const randomHex = () => Math.floor(Math.random() * 16).toString(16).toUpperCase();
  const newLicenceKey = `WLYL-${Array.from({length: 4}, () => Array.from({length: 4}, randomHex).join('')).join('-')}`;
  const newApiKey = `wlyl_sk_${Array.from({length: 12}, randomHex).join('')}`;
  const newLicenceId = `LC-${Math.floor(Math.random() * 9000 + 1000)}`;

  const todayStr = new Date().toISOString().substring(0, 10);
  const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const newSchool = {
    school_id: newSchoolId,
    school_name,
    username,
    password,
    api_key: newApiKey,
    licence_id: newLicenceId,
    licence_key: newLicenceKey,
    machine_id: '', // Blank until activated
    issued: '',
    expires: '',
    days_left: 0,
    active: false, // Inactive until licence key is activated
    subscription_start: subscription_start || todayStr,
    subscription_expire: subscription_expire || nextYearStr,
    amount_paid: Number(amount_paid) || 0
  };

  db.schools.push(newSchool);
  saveDb();

  res.status(201).json({
    success: true,
    message: 'School created successfully',
    school: newSchool
  });
});

// --- TENANT SPECIFIC API ENDPOINTS (SCOPED BY school_id) ---

// GET /v1/ping
app.get('/v1/ping', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Missing credentials' });
  }

  const token = authHeader.split(' ')[1];
  let school;

  if (token.startsWith('school_token_')) {
    const schoolId = token.substring('school_token_'.length);
    school = db.schools.find(s => s.school_id === schoolId);
  } else {
    school = db.schools.find(s => s.api_key === token);
  }

  if (!school) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid API Key or Token' });
  }

  res.json({
    success: true,
    server_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    school_id: school.school_id,
    school_name: school.school_name,
    active: school.active,
    version: 'v1'
  });
});

// GET /v1/schools/public
app.get('/v1/schools/public', (req, res) => {
  res.json({
    success: true,
    schools: db.schools.map(s => ({
      school_id: s.school_id,
      school_name: s.school_name,
      api_key: s.api_key
    }))
  });
});

// POST /v1/licence/activate
app.post('/v1/licence/activate', (req, res) => {
  const { licence_key, school_name, machine_id, app_version } = req.body;

  if (!licence_key || !school_name || !machine_id) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing required activation fields',
      code: 400
    });
  }

  const school = db.schools.find(s => s.licence_key === licence_key);
  if (!school) {
    return res.status(400).json({
      success: false,
      error: 'invalid_key',
      message: 'Licence key is invalid or already used'
    });
  }

  // Pre-configured machine ID lock check
  if (school.machine_id && school.machine_id !== machine_id) {
    return res.status(409).json({
      success: false,
      error: 'machine_mismatch',
      message: 'Key activated on different machine. Contact rc603324@gmail.com'
    });
  }

  // Activate license
  school.school_name = school_name;
  school.machine_id = machine_id;
  school.active = true;
  school.issued = new Date().toISOString().substring(0, 10);

  if (school.subscription_expire) {
    school.expires = school.subscription_expire;
    const diffTime = Math.max(0, new Date(school.expires) - new Date(school.issued));
    school.days_left = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else {
    school.expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    school.days_left = 365;
  }
  
  saveDb();

  res.json({
    success: true,
    licence_id: school.licence_id,
    school: school_name,
    issued: school.issued,
    expires: school.expires,
    days_left: school.days_left,
    api_key: school.api_key,
    school_id: school.school_id
  });
});

// POST /v1/licence/event
app.post('/v1/licence/event', (req, res) => {
  const eventData = req.body;
  
  if (!eventData.event || !eventData.licence_id) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing event description or licence ID',
      code: 400
    });
  }

  db.licence_events.push({
    ...eventData,
    school_id: req.school_id,
    id: 'EVT_' + Date.now(),
    server_timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });
  saveDb();

  res.json({
    success: true,
    message: 'Event recorded'
  });
});

// GET /v1/licence/event-logs (Dev Utility)
app.get('/v1/licence/event-logs', (req, res) => {
  const schoolId = req.is_super ? req.query.school_id : req.school_id;
  
  let logs = db.licence_events;
  if (schoolId) {
    logs = logs.filter(l => l.school_id === schoolId);
  }
  
  res.json({ success: true, logs });
});

// Helper: Scan Duplicate Check (scoped to school)
function isDuplicateScan(schoolId, newScan) {
  const scanDate = newScan.scan_time.split(' ')[0];
  
  return db.scans.some(scan => 
    scan.school_id === schoolId &&
    scan.card_id === newScan.card_id &&
    scan.scan_type === newScan.scan_type &&
    scan.scan_time.startsWith(scanDate)
  );
}

// POST /v1/scan
app.post('/v1/scan', (req, res) => {
  const scan = req.body;

  if (!scan.card_id || !scan.scan_time || !scan.scan_type) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing card_id, scan_time, or scan_type',
      code: 400
    });
  }

  const schoolId = req.school_id;

  if (isDuplicateScan(schoolId, scan)) {
    const scanTime = scan.scan_time.split(' ')[1].substring(0, 5);
    return res.status(409).json({
      success: false,
      error: 'duplicate',
      message: `Already recorded ${scan.scan_type} at ${scanTime}`
    });
  }

  // If scan is out, we check if there's a morning_in scan today to update
  if (scan.scan_type === 'out') {
    const scanDate = scan.scan_time.split(' ')[0];
    const morningScan = db.scans.find(s => 
      s.school_id === schoolId &&
      s.card_id === scan.card_id &&
      s.scan_type === 'morning_in' &&
      s.scan_time.startsWith(scanDate)
    );

    if (morningScan) {
      const entryTime = morningScan.scan_time.split(' ')[1];
      const exitTime = scan.scan_time.split(' ')[1];
      
      const entryParts = entryTime.split(':');
      const exitParts = exitTime.split(':');
      
      const entryMin = parseInt(entryParts[0]) * 60 + parseInt(entryParts[1]);
      const exitMin = parseInt(exitParts[0]) * 60 + parseInt(exitParts[1]);
      
      morningScan.out_time = exitTime;
      morningScan.duration_minutes = Math.max(0, exitMin - entryMin);
    }
  }

  const record_id = `REC_${scan.scan_time.split(' ')[0].replace(/-/g, '')}_${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`;
  const newRecord = {
    id: record_id,
    school_id: schoolId,
    ...scan
  };

  db.scans.push(newRecord);
  saveDb();

  // Notify connected real-time SSE clients
  broadcastScanEvent(schoolId, newRecord);

  res.json({
    success: true,
    message: 'Scan recorded',
    record_id: record_id,
    server_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });
});

// POST /v1/scan/batch
app.post('/v1/scan/batch', (req, res) => {
  const { scans, school_id, machine_id } = req.body;

  if (!Array.isArray(scans)) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Scans list must be an array',
      code: 400
    });
  }

  const schoolId = req.school_id;
  let synced = 0;
  let failed = 0;
  const results = [];

  scans.forEach(scan => {
    if (isDuplicateScan(schoolId, scan)) {
      failed++;
      results.push({
        local_id: scan.local_id,
        status: 'duplicate',
        message: 'Already exists'
      });
    } else {
      if (scan.scan_type === 'out') {
        const scanDate = scan.scan_time.split(' ')[0];
        const morningScan = db.scans.find(s => 
          s.school_id === schoolId &&
          s.card_id === scan.card_id &&
          s.scan_type === 'morning_in' &&
          s.scan_time.startsWith(scanDate)
        );

        if (morningScan) {
          const entryTime = morningScan.scan_time.split(' ')[1];
          const exitTime = scan.scan_time.split(' ')[1];
          const entryParts = entryTime.split(':');
          const exitParts = exitTime.split(':');
          const entryMin = parseInt(entryParts[0]) * 60 + parseInt(entryParts[1]);
          const exitMin = parseInt(exitParts[0]) * 60 + parseInt(exitParts[1]);
          
          morningScan.out_time = exitTime;
          morningScan.duration_minutes = Math.max(0, exitMin - entryMin);
        }
      }

      const record_id = `REC_${scan.scan_time.split(' ')[0].replace(/-/g, '')}_${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`;
      const serverScan = { ...scan };
      delete serverScan.local_id;
      
      const newRecord = {
        id: record_id,
        school_id: schoolId,
        ...serverScan
      };

      db.scans.push(newRecord);
      synced++;
      results.push({
        local_id: scan.local_id,
        status: 'ok',
        record_id: record_id
      });
      broadcastScanEvent(schoolId, newRecord);
    }
  });

  if (synced > 0) {
    saveDb();
  }

  res.json({
    success: true,
    synced,
    failed,
    results
  });
});

// GET /v1/cards
app.get('/v1/cards', (req, res) => {
  const { active } = req.query;
  const schoolId = req.school_id; // Scoped by active session or API key

  let cards = db.cards.filter(c => c.school_id === schoolId);
  
  if (active === 'true') {
    cards = cards.filter(c => c.active);
  } else if (active === 'false') {
    cards = cards.filter(c => !c.active);
  }

  res.json({
    success: true,
    count: cards.length,
    cards: cards
  });
});

// POST /v1/cards
app.post('/v1/cards', (req, res) => {
  const { card_id, name, department } = req.body;
  const schoolId = req.school_id;

  if (!card_id || !name || !department) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing card_id, name, or department',
      code: 400
    });
  }

  const existingCard = db.cards.find(c => c.card_id === card_id && c.school_id === schoolId);
  if (existingCard) {
    if (existingCard.active) {
      return res.status(409).json({
        success: false,
        error: 'card_exists',
        message: `Card ${card_id} already registered`
      });
    } else {
      existingCard.name = name;
      existingCard.department = department;
      existingCard.active = true;
      saveDb();
      return res.status(201).json({
        success: true,
        message: 'Card re-registered and activated',
        card_id: card_id
      });
    }
  }

  const newCard = {
    card_id,
    school_id: schoolId,
    name,
    department,
    active: true,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  db.cards.push(newCard);
  saveDb();

  res.status(201).json({
    success: true,
    message: 'Card registered',
    card_id: card_id
  });
});

// PUT /v1/cards/:card_id
app.put('/v1/cards/:card_id', (req, res) => {
  const { card_id } = req.params;
  const { name, department } = req.body;
  const schoolId = req.school_id;

  const card = db.cards.find(c => c.card_id === card_id && c.school_id === schoolId);
  if (!card) {
    return res.status(404).json({
      success: false,
      error: 'not_found',
      message: 'Card not found',
      code: 404
    });
  }

  if (name) card.name = name;
  if (department) card.department = department;
  saveDb();

  res.json({
    success: true,
    message: 'Card updated'
  });
});

// DELETE /v1/cards/:card_id
app.delete('/v1/cards/:card_id', (req, res) => {
  const { card_id } = req.params;
  const schoolId = req.school_id;

  const card = db.cards.find(c => c.card_id === card_id && c.school_id === schoolId);
  if (!card) {
    return res.status(404).json({
      success: false,
      error: 'not_found',
      message: 'Card not found',
      code: 404
    });
  }

  card.active = false;
  saveDb();

  res.json({
    success: true,
    message: 'Card deactivated'
  });
});

// GET /v1/events (SSE Real-Time Sync Channel)
app.get('/v1/events', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  let schoolId = null;
  let isSuper = false;

  if (token === db.super_admin.token) {
    isSuper = true;
  } else if (token.startsWith('school_token_')) {
    schoolId = token.substring('school_token_'.length);
    const school = db.schools.find(s => s.school_id === schoolId);
    if (!school || !school.active) {
      return res.status(403).json({ success: false, message: 'Invalid or inactive school' });
    }
  } else {
    // Check if it's a hardware key
    const school = db.schools.find(s => s.api_key === token);
    if (school && school.active) {
      schoolId = school.school_id;
    } else {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  res.write('\n');

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    school_id: schoolId,
    is_super: isSuper,
    res
  };

  sseClients.push(newClient);

  // Keep connection alive with pings every 20s
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {}
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// GET /v1/attendance
app.get('/v1/attendance', (req, res) => {
  const { from, to, card_id, department, session, scan_type, page = 1, per_page = 100 } = req.query;
  const schoolId = req.is_super ? req.query.school_id : req.school_id;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing required date parameters from and to',
      code: 400
    });
  }

  let filtered = db.scans.filter(scan => {
    const scanDate = scan.scan_time.split(' ')[0];
    const inRange = scanDate >= from && scanDate <= to;
    const matchSchool = schoolId ? scan.school_id === schoolId : true;
    return inRange && matchSchool;
  });

  if (card_id) {
    filtered = filtered.filter(s => s.card_id === card_id);
  }
  if (department) {
    filtered = filtered.filter(s => s.department.toLowerCase() === department.toLowerCase());
  }
  if (session) {
    filtered = filtered.filter(s => s.session.toLowerCase() === session.toLowerCase());
  }
  if (scan_type) {
    filtered = filtered.filter(s => s.scan_type === scan_type);
  }

  // Sort by scan time descending
  filtered.sort((a, b) => b.scan_time.localeCompare(a.scan_time));

  // Pagination
  const total = filtered.length;
  const pageNum = parseInt(page);
  const limitNum = parseInt(per_page);
  const pages = Math.ceil(total / limitNum);
  const offset = (pageNum - 1) * limitNum;
  const paginatedRecords = filtered.slice(offset, offset + limitNum);

  res.json({
    success: true,
    total,
    page: pageNum,
    pages,
    records: paginatedRecords
  });
});

// GET /v1/attendance/summary
app.get('/v1/attendance/summary', (req, res) => {
  const { from, to } = req.query;
  const schoolId = req.school_id;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing required date parameters from and to',
      code: 400
    });
  }

  // Filter scans in range for this school
  const rangeScans = db.scans.filter(scan => {
    const scanDate = scan.scan_time.split(' ')[0];
    return scanDate >= from && scanDate <= to && scan.school_id === schoolId;
  });

  // Calculate unique working days
  const workingDaysSet = new Set(rangeScans.map(s => s.scan_time.split(' ')[0]));
  const totalWorkingDays = workingDaysSet.size || 1;

  // Active cards in school
  const activeCards = db.cards.filter(c => c.school_id === schoolId && c.active);

  const summary = activeCards.map(card => {
    const cardScans = rangeScans.filter(s => s.card_id === card.card_id);
    
    // Group scans by date
    const dateGroups = {};
    cardScans.forEach(s => {
      const d = s.scan_time.split(' ')[0];
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(s);
    });

    let present = 0;
    let late = 0;
    let halfDay = 0;
    let totalDuration = 0;
    let durationCount = 0;

    Object.keys(dateGroups).forEach(d => {
      const dayScans = dateGroups[d];
      if (dayScans.length > 0) {
        present++;
      }

      if (dayScans.some(s => s.is_late)) {
        late++;
      }

      const morningIn = dayScans.find(s => s.scan_type === 'morning_in');
      if (morningIn) {
        if (!morningIn.out_time) {
          halfDay++;
        } else {
          totalDuration += morningIn.duration_minutes;
          durationCount++;
        }
      } else {
        halfDay++;
      }
    });

    const absent = Math.max(0, totalWorkingDays - present);
    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return {
      card_id: card.card_id,
      name: card.name,
      department: card.department,
      present,
      late,
      half_day: halfDay,
      absent,
      avg_duration: avgDuration
    };
  });

  // Department totals
  const depts = [...new Set(activeCards.map(c => c.department))];
  const departmentTotals = depts.map(dept => {
    const deptCards = summary.filter(s => s.department === dept);
    const staffCount = deptCards.length;
    
    const sumPresent = deptCards.reduce((acc, curr) => acc + curr.present, 0);
    const sumAbsent = deptCards.reduce((acc, curr) => acc + curr.absent, 0);

    return {
      department: dept,
      staff_count: staffCount,
      avg_present: staffCount > 0 ? parseFloat((sumPresent / staffCount).toFixed(1)) : 0,
      avg_absent: staffCount > 0 ? parseFloat((sumAbsent / staffCount).toFixed(1)) : 0
    };
  });

  res.json({
    success: true,
    period: { from, to },
    total_staff: activeCards.length,
    total_working_days: totalWorkingDays,
    summary,
    department_totals: departmentTotals
  });
});

// GET /v1/attendance/absent
app.get('/v1/attendance/absent', (req, res) => {
  const { date } = req.query;
  const schoolId = req.school_id;

  if (!date) {
    return res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing date parameter',
      code: 400
    });
  }

  const activeCards = db.cards.filter(c => c.school_id === schoolId && c.active);
  const dayScans = db.scans.filter(s => s.scan_time.startsWith(date) && s.school_id === schoolId);

  const presentIds = new Set(dayScans.map(s => s.card_id));

  const absent = activeCards
    .filter(c => !presentIds.has(c.card_id))
    .map(c => ({
      card_id: c.card_id,
      name: c.name,
      department: c.department
    }));

  const late = dayScans
    .filter(s => s.is_late)
    .map(s => ({
      card_id: s.card_id,
      name: s.name,
      scan_time: s.scan_time.split(' ')[1]
    }));

  res.json({
    success: true,
    date,
    absent_count: absent.length,
    late_count: late.length,
    absent,
    late
  });
});

// RESET UTILITY - RESET TO SEED DEFAULT
app.post('/admin/reset', async (req, res) => {
  if (fs.existsSync(CLOUD_DB_PATH)) {
    fs.unlinkSync(CLOUD_DB_PATH);
  }
  
  // Clear Supabase first
  await clearSupabaseDb();
  
  db.scans = [];
  db.licence_events = [];
  db.schools = [
    {
      school_id: 'SCH001',
      school_name: 'ABC School Hyderabad',
      username: 'school1',
      password: 'school1',
      api_key: 'wlyl_sk_A1B2C3D4E5F6',
      licence_id: 'LC-0042',
      licence_key: 'WLYL-A3F2-K9P1-M7X4-B2Q8',
      machine_id: 'A1B2C3D4',
      issued: '2026-05-25',
      expires: '2027-05-25',
      days_left: 364,
      active: true,
      subscription_start: '2026-05-25',
      subscription_expire: '2027-05-25',
      amount_paid: 15000
    },
    {
      school_id: 'SCH002',
      school_name: 'Oakridge International',
      username: 'school2',
      password: 'school2',
      api_key: 'wlyl_sk_B2C3D4E5F6G7',
      licence_id: 'LC-0043',
      licence_key: 'WLYL-B3F2-L9P1-N7X4-C2Q8',
      machine_id: 'B2C3D4E5',
      issued: '2026-05-25',
      expires: '2027-05-25',
      days_left: 364,
      active: true,
      subscription_start: '2026-05-20',
      subscription_expire: '2027-05-20',
      amount_paid: 18000
    }
  ];
  db.cards = [
    { card_id: '1001001001', school_id: 'SCH001', name: 'Ravi Kumar', department: 'Teaching', active: true, created_at: '2026-04-01 09:00:00' },
    { card_id: '1001001002', school_id: 'SCH001', name: 'Priya Sharma', department: 'Teaching', active: true, created_at: '2026-04-01 09:15:00' },
    { card_id: '1001001003', school_id: 'SCH001', name: 'Krishna Reddy', department: 'Admin', active: true, created_at: '2026-04-02 08:30:00' },
    { card_id: '1001001004', school_id: 'SCH001', name: 'Suresh Goud', department: 'Support', active: true, created_at: '2026-04-03 10:00:00' },
    { card_id: '1001001005', school_id: 'SCH002', name: 'Venkat Rao', department: 'Admin', active: true, created_at: '2026-04-05 09:00:00' },
    { card_id: '1001001006', school_id: 'SCH002', name: 'Kalyani Sen', department: 'Teaching', active: true, created_at: '2026-04-10 09:00:00' }
  ];
  
  seedData();
  saveDb();
  res.json({ success: true, message: 'Multi-tenant database reset successfully' });
});

// Start Server after loading database from Supabase
loadDb().then(() => {
  app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(`  WLYL Multi-Tenant Attendance Server running on port ${PORT}`);
    console.log(`  API Base URL: http://localhost:${PORT}/v1`);
    console.log(`  Web Dashboard: http://localhost:${PORT}`);
    console.log(`=============================================================`);
  });
});
