using './main.bicep'

// Non-secret parameter defaults
param location = 'westeurope'
param prefix = 'rentavehicle'
param sqlAdminLogin = 'sqladmin'
param sqlDatabase = 'RentAVehicle'
param sqlPort = '1433'

// Secrets are NOT stored here — provided at deploy time:
// az deployment group create \
//   --resource-group <rg-name> \
//   --template-file infra/main.bicep \
//   --parameters infra/main.bicepparam \
//   --parameters sqlAdminPassword='<value>' azureClientSecret='<value>' \
//     entraClientId='<value>' entraTenantId='<value>' \
//     notificationSenderEmail='<value>' teamsAppId='<value>' \
//     appBaseUrl='<value>' sharepointOrigin='<value>'
