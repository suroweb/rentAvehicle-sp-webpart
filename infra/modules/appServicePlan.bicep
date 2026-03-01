// App Service Plan — Consumption (Y1) for Azure Functions
// Provisions a serverless compute plan with pay-per-execution pricing

@description('Name of the App Service Plan')
param name string

@description('Azure region for the resource')
param location string

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: name
  location: location
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

@description('Resource ID of the App Service Plan')
output id string = appServicePlan.id
