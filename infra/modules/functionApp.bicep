// Function App — Linux Node 22 with all application settings and CORS
// Provisions the Azure Functions runtime with full configuration

@description('Name of the Function App')
param name string

@description('Azure region for the resource')
param location string

@description('Resource ID of the App Service Plan')
param appServicePlanId string

@description('Storage Account connection string for AzureWebJobsStorage')
param storageConnectionString string

@description('SQL Server hostname (FQDN)')
param sqlServer string

@description('SQL Database name')
param sqlDatabase string

@description('SQL Server port')
param sqlPort string = '1433'

@description('SQL admin username')
param sqlUser string

@secure()
@description('SQL admin password')
param sqlPassword string

@description('Azure tenant ID for Entra ID authentication')
param tenantId string

@description('Entra ID app registration client ID')
param clientId string

@secure()
@description('Entra ID app registration client secret')
param azureClientSecret string

@description('Email address for notification sender')
param notificationSenderEmail string

@description('Teams app ID for activity notifications')
param teamsAppId string

@description('Base URL of the application')
param appBaseUrl string

@description('SharePoint tenant origin for CORS (e.g. https://contoso.sharepoint.com)')
param sharepointOrigin string

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  kind: 'functionapp,linux'
  properties: {
    reserved: true
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'node|22'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          sharepointOrigin
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'AZURE_SQL_SERVER'
          value: sqlServer
        }
        {
          name: 'AZURE_SQL_DATABASE'
          value: sqlDatabase
        }
        {
          name: 'AZURE_SQL_PORT'
          value: sqlPort
        }
        {
          name: 'AZURE_SQL_USER'
          value: sqlUser
        }
        {
          name: 'AZURE_SQL_PASSWORD'
          value: sqlPassword
        }
        {
          name: 'AZURE_TENANT_ID'
          value: tenantId
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: clientId
        }
        {
          name: 'AZURE_CLIENT_SECRET'
          value: azureClientSecret
        }
        {
          name: 'NOTIFICATION_SENDER_EMAIL'
          value: notificationSenderEmail
        }
        {
          name: 'TEAMS_APP_ID'
          value: teamsAppId
        }
        {
          name: 'APP_BASE_URL'
          value: appBaseUrl
        }
      ]
    }
  }
}

@description('Name of the Function App')
output name string = functionApp.name

@description('Default hostname of the Function App')
output defaultHostName string = functionApp.properties.defaultHostName
