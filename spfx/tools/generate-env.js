const fs = require('fs');
const path = require('path');

// Secrets live one level above the repo root: ../../.rentavehicle/secrets.json
const secretsPath = path.resolve(__dirname, '../../../.rentavehicle/secrets.json');
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

const output = `// AUTO-GENERATED — do not edit. Source: .rentavehicle/secrets.json
export const ENV = {
  AZURE_CLIENT_ID: '${secrets.AZURE_CLIENT_ID}',
  AZURE_TENANT_ID: '${secrets.AZURE_TENANT_ID || ''}',
  APP_BASE_URL: '${secrets.APP_BASE_URL || ''}',
} as const;
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');
console.log('Generated spfx/src/config/env.generated.ts');
