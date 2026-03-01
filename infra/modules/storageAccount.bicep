// Storage Account — Standard LRS for Azure Functions state
// Required for AzureWebJobsStorage on Consumption plan

@description('Name of the Storage Account (lowercase alphanumeric only, max 24 chars)')
param name string

@description('Azure region for the resource')
param location string

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: name
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

@description('Connection string for the Storage Account')
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
