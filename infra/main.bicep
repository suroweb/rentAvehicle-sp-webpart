// RentAVehicle — Azure Infrastructure Orchestrator
// Provisions all resources for the Azure Functions API backend
//
// Deploy:
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam \
//     --parameters sqlAdminPassword='<value>' azureClientSecret='<value>' \
//       entraClientId='<value>' entraTenantId='<value>' \
//       notificationSenderEmail='<value>' teamsAppId='<value>' \
//       appBaseUrl='<value>' sharepointOrigin='<value>'

targetScope = 'resourceGroup'

// --- Parameters ---

@description('Azure region for all resources')
param location string = 'westeurope'

@description('Naming prefix for all resources (e.g. rentavehicle)')
param prefix string

@description('SQL Server admin username')
param sqlAdminLogin string

@description('SQL Database name')
param sqlDatabase string = 'RentAVehicle'

@description('SQL Server port')
param sqlPort string = '1433'

@secure()
@description('SQL Server admin password')
param sqlAdminPassword string

@secure()
@description('Entra ID app registration client secret')
param azureClientSecret string

@description('Entra ID app registration client ID')
param entraClientId string

@description('Azure tenant ID')
param entraTenantId string

@description('Email address for notification sender (Graph Mail.Send)')
param notificationSenderEmail string

@description('Teams app ID for activity notifications')
param teamsAppId string

@description('Base URL of the application')
param appBaseUrl string

@description('SharePoint tenant origin for CORS (e.g. https://contoso.sharepoint.com)')
param sharepointOrigin string

// --- Modules ---

module plan 'modules/appServicePlan.bicep' = {
  name: 'appServicePlan'
  params: {
    name: '${prefix}-plan'
    location: location
  }
}

module storage 'modules/storageAccount.bicep' = {
  name: 'storageAccount'
  params: {
    name: '${prefix}st'
    location: location
  }
}

module sql 'modules/sqlServer.bicep' = {
  name: 'sqlServer'
  params: {
    serverName: '${prefix}-sql'
    databaseName: sqlDatabase
    location: location
    adminLogin: sqlAdminLogin
    adminPassword: sqlAdminPassword
  }
}

module func 'modules/functionApp.bicep' = {
  name: 'functionApp'
  params: {
    name: '${prefix}-func'
    location: location
    appServicePlanId: plan.outputs.id
    storageConnectionString: storage.outputs.connectionString
    sqlServer: sql.outputs.serverFqdn
    sqlDatabase: sql.outputs.databaseName
    sqlPort: sqlPort
    sqlUser: sqlAdminLogin
    sqlPassword: sqlAdminPassword
    tenantId: entraTenantId
    clientId: entraClientId
    azureClientSecret: azureClientSecret
    notificationSenderEmail: notificationSenderEmail
    teamsAppId: teamsAppId
    appBaseUrl: appBaseUrl
    sharepointOrigin: sharepointOrigin
  }
}

module auth 'modules/authConfig.bicep' = {
  name: 'authConfig'
  params: {
    functionAppName: func.outputs.name
    entraClientId: entraClientId
    entraTenantId: entraTenantId
  }
}

// --- Outputs ---

@description('URL of the deployed Function App')
output functionAppUrl string = 'https://${func.outputs.defaultHostName}'

@description('Fully qualified domain name of the SQL Server')
output sqlServerFqdn string = sql.outputs.serverFqdn
