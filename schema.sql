-- 1. Super Admin Credentials Table
CREATE TABLE IF NOT EXISTS super_admin (
  id INT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL
);

-- 2. Schools Table
CREATE TABLE IF NOT EXISTS schools (
  school_id VARCHAR(50) PRIMARY KEY,
  school_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  licence_id VARCHAR(50),
  licence_key VARCHAR(255) UNIQUE NOT NULL,
  machine_id VARCHAR(255),
  issued VARCHAR(50),
  expires VARCHAR(50),
  days_left INT DEFAULT 0,
  active BOOLEAN DEFAULT FALSE,
  subscription_start VARCHAR(50),
  subscription_expire VARCHAR(50),
  amount_paid NUMERIC DEFAULT 0
);

-- 3. Cards Table
CREATE TABLE IF NOT EXISTS cards (
  card_id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) REFERENCES schools(school_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at VARCHAR(50) NOT NULL
);

-- 4. Scans Table
CREATE TABLE IF NOT EXISTS scans (
  id VARCHAR(100) PRIMARY KEY,
  school_id VARCHAR(50) REFERENCES schools(school_id) ON DELETE CASCADE,
  card_id VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  session VARCHAR(50) NOT NULL,
  scan_time VARCHAR(50) NOT NULL,
  scan_type VARCHAR(50) NOT NULL,
  is_late BOOLEAN DEFAULT FALSE,
  out_time VARCHAR(50),
  duration_minutes INT,
  scan_mode VARCHAR(50),
  entry_point VARCHAR(255),
  device VARCHAR(255),
  source_port VARCHAR(255),
  machine_id VARCHAR(255)
);

-- 5. Licence Events Table
CREATE TABLE IF NOT EXISTS licence_events (
  id VARCHAR(100) PRIMARY KEY,
  event VARCHAR(100) NOT NULL,
  licence_id VARCHAR(50),
  school VARCHAR(255),
  machine_id VARCHAR(255),
  expires VARCHAR(50),
  days_left INT DEFAULT 0,
  app_version VARCHAR(50),
  timestamp VARCHAR(50),
  school_id VARCHAR(50) REFERENCES schools(school_id) ON DELETE CASCADE,
  server_timestamp VARCHAR(50)
);
