const fs = require('fs');
const path = require('path');

// Secrets live one level above the repo root: ../../.rentavehicle/secrets.json
const secretsPath = path.resolve(__dirname, '../../../.rentavehicle/secrets.json');
const devConfigPath = path.resolve(__dirname, '../../dev.config.json');
const outputPath = path.resolve(__dirname, '../src/config/env.generated.ts');

if (!fs.existsSync(secretsPath)) {
  console.error(
    'Missing .rentavehicle/secrets.json\n' +
    'Expected at: ' + secretsPath + '\n' +
    'Create it with your Azure credentials.'
  );
  process.exit(1);
}

const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

const required = ['AZURE_CLIENT_ID'];
const missing = required.filter(k => !secrets[k]);
if (missing.length) {
  console.error(`Missing required secrets: ${missing.join(', ')}`);
  process.exit(1);
}

// Read dev user identity from dev.config.json (optional)
let devUserName = '';
let devUserEmail = '';
if (fs.existsSync(devConfigPath)) {
  try {
    const devConfig = JSON.parse(fs.readFileSync(devConfigPath, 'utf8'));
    devUserName = devConfig.name || '';
    devUserEmail = devConfig.email || '';
  } catch {
    // dev.config.json is optional — continue with empty defaults
  }
}

const output = `// AUTO-GENERATED — do not edit. Source: .rentavehicle/secrets.json + dev.config.json
export const ENV = {
  AZURE_CLIENT_ID: '${secrets.AZURE_CLIENT_ID}',
  AZURE_TENANT_ID: '${secrets.AZURE_TENANT_ID || ''}',
  APP_BASE_URL: '${secrets.APP_BASE_URL || ''}',
  DEV_USER_NAME: '${devUserName}',
  DEV_USER_EMAIL: '${devUserEmail}',
} as const;
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');
console.log('Generated spfx/src/config/env.generated.ts');
