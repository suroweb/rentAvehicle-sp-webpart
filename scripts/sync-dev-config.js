#!/usr/bin/env node
/**
 * Syncs dev config into api/local.settings.json from multiple sources:
 *
 *   1. api/local.settings.template.json  — committed, safe defaults
 *   2. dev.config.json                   — role/name/email/location overrides
 *   3. ../.rentavehicle/secrets.json      — tenant secrets (outside project)
 *
 * The generated api/local.settings.json is gitignored.
 *
 * Usage:
 *   node scripts/sync-dev-config.js              # full sync
 *   node scripts/sync-dev-config.js --role Admin  # set role (also updates dev.config.json)
 *   node scripts/sync-dev-config.js --clean       # remove generated local.settings.json
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'api', 'local.settings.template.json');
const LOCAL_SETTINGS = path.join(ROOT, 'api', 'local.settings.json');
const DEV_CONFIG = path.join(ROOT, 'dev.config.json');
const SECRETS_FILE = path.join(ROOT, '..', '.rentavehicle', 'secrets.json');

const DEV_CONFIG_MAP = {
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

// --- Handle --clean flag ---
const args = process.argv.slice(2);
if (args.includes('--clean')) {
  if (fs.existsSync(LOCAL_SETTINGS)) {
    fs.unlinkSync(LOCAL_SETTINGS);
    console.log('Removed api/local.settings.json');
  } else {
    console.log('api/local.settings.json already absent');
  }
  process.exit(0);
}

// --- Handle --role shortcut ---
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
  console.log('dev.config.json -> role: ' + newRole);
}

// --- Step 1: Start from template ---
if (!fs.existsSync(TEMPLATE)) {
  console.error('Missing api/local.settings.template.json');
  process.exit(1);
}
const settings = readJson(TEMPLATE);

// --- Step 2: Apply dev.config.json overrides ---
if (fs.existsSync(DEV_CONFIG)) {
  const devConfig = readJson(DEV_CONFIG);
  for (const [devKey, envKey] of Object.entries(DEV_CONFIG_MAP)) {
    if (devConfig[devKey] !== undefined) {
      settings.Values[envKey] = devConfig[devKey];
    }
  }
  console.log('  Applied dev.config.json (role: ' + devConfig.role + ', name: ' + devConfig.name + ')');
} else {
  console.log('  No dev.config.json found, using template defaults');
}

// --- Step 3: Apply external secrets ---
if (fs.existsSync(SECRETS_FILE)) {
  const secrets = readJson(SECRETS_FILE);
  let secretCount = 0;
  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined && value !== '') {
      settings.Values[key] = value;
      secretCount++;
    }
  }
  console.log('  Applied ' + secretCount + ' secret(s) from ../.rentavehicle/secrets.json');

  // --- Step 4: Replace CORS placeholder with tenant domain ---
  if (secrets.SHAREPOINT_DOMAIN) {
    settings.Host.CORS = settings.Host.CORS.replace(
      'contoso.sharepoint.com',
      secrets.SHAREPOINT_DOMAIN
    );
    console.log('  Applied CORS domain: ' + secrets.SHAREPOINT_DOMAIN);
  } else {
    console.log('  CORS domain not set (add SHAREPOINT_DOMAIN to secrets.json for hosted workbench)');
  }
} else {
  console.log('  No secrets file found at ../.rentavehicle/secrets.json');
  console.log('  To configure tenant secrets, create that file with:');
  console.log('  {');
  console.log('    "AZURE_TENANT_ID": "your-tenant-id",');
  console.log('    "AZURE_CLIENT_ID": "your-client-id",');
  console.log('    "AZURE_CLIENT_SECRET": "your-client-secret",');
  console.log('    "NOTIFICATION_SENDER_EMAIL": "sender@yourtenant.com",');
  console.log('    "APP_BASE_URL": "https://yourtenant.sharepoint.com/sites/rentavehicle",');
  console.log('    "SHAREPOINT_DOMAIN": "yourtenant.sharepoint.com"');
  console.log('  }');
}

// --- Write generated local.settings.json ---
writeJson(LOCAL_SETTINGS, settings);
console.log('Generated api/local.settings.json (gitignored)');
