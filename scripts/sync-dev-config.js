#!/usr/bin/env node
/**
 * Syncs dev.config.json → api/local.settings.json
 *
 * Usage:
 *   node scripts/sync-dev-config.js              # sync all values from dev.config.json
 *   node scripts/sync-dev-config.js --role Admin  # set role directly (also updates dev.config.json)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEV_CONFIG = path.join(ROOT, 'dev.config.json');
const LOCAL_SETTINGS = path.join(ROOT, 'api', 'local.settings.json');

const FIELD_MAP = {
  role: 'LOCAL_DEV_ROLE',
  name: 'LOCAL_DEV_NAME',
  email: 'LOCAL_DEV_EMAIL',
  officeLocation: 'LOCAL_DEV_OFFICE_LOCATION',
};

const VALID_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// Handle --role shortcut: node scripts/sync-dev-config.js --role Admin
const args = process.argv.slice(2);
const roleIdx = args.indexOf('--role');
if (roleIdx !== -1) {
  const newRole = args[roleIdx + 1];
  if (!newRole || !VALID_ROLES.includes(newRole)) {
    console.error('Valid roles: ' + VALID_ROLES.join(', '));
    process.exit(1);
  }
  const devConfig = readJson(DEV_CONFIG);
  devConfig.role = newRole;
  writeJson(DEV_CONFIG, devConfig);
  console.log('dev.config.json → role: ' + newRole);
}

// Sync dev.config.json → api/local.settings.json
const devConfig = readJson(DEV_CONFIG);
const localSettings = readJson(LOCAL_SETTINGS);

let changed = false;
for (const [devKey, envKey] of Object.entries(FIELD_MAP)) {
  if (devConfig[devKey] !== undefined && localSettings.Values[envKey] !== devConfig[devKey]) {
    localSettings.Values[envKey] = devConfig[devKey];
    changed = true;
  }
}

if (changed) {
  writeJson(LOCAL_SETTINGS, localSettings);
  console.log('Synced dev.config.json → api/local.settings.json');
  console.log('  Role: ' + devConfig.role + ' | Name: ' + devConfig.name + ' | Location: ' + devConfig.officeLocation);
} else {
  console.log('api/local.settings.json already in sync');
}
