// SQL Server + Database + Firewall Rule
// Provisions Azure SQL with Basic tier and allows Azure services access

@description('Name of the SQL Server')
param serverName string

@description('Name of the SQL Database')
param databaseName string = 'RentAVehicle'

@description('Azure region for the resource')
param location string

@description('SQL Server admin login username')
param adminLogin string

@secure()
@description('SQL Server admin login password')
param adminPassword string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: serverName
  location: location
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure services to access the SQL Server
resource firewallRule 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
}

@description('Fully qualified domain name of the SQL Server')
output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName

@description('Name of the SQL Database')
output databaseName string = database.name
