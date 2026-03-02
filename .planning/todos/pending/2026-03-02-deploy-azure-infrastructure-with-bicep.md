---
created: 2026-03-02T00:20:00.000Z
title: Deploy Azure infrastructure with Bicep
area: tooling
files:
  - infra/main.bicep
  - infra/main.bicepparam
  - infra/modules/functionApp.bicep
  - infra/modules/sqlServer.bicep
  - infra/modules/storageAccount.bicep
  - infra/modules/authConfig.bicep
---

## Problem

Bicep IaC templates were created in phase 11-02 but have not been deployed to Azure yet. The SPFx solution on the live tenant still connects to the local Azure SQL Edge database. Need to provision real Azure resources and wire the Function App to Azure SQL Database.

## Solution

Run the Bicep deployment against an Azure subscription:

```bash
az deployment group create \
  --resource-group <rg-name> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  sqlAdminPassword='<secure-password>' \
  azureClientSecret='<entra-client-secret>'
```

Then:
1. Run SQL migrations against the new Azure SQL Database
2. Deploy the API code to the Azure Function App
3. Update SPFx `env.generated.ts` with the production `APP_BASE_URL`
4. Verify end-to-end: SPFx → Azure Functions → Azure SQL
