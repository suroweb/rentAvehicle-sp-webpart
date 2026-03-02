---
created: 2026-02-25T20:30:00.000Z
title: Infrastructure as Code Bicep templates
area: tooling
files:
  - api/src/services/database.ts
  - api/local.settings.json
---

## Problem

All Azure resources (SQL Server, Functions App, App Insights, Key Vault) are created manually via the Azure Portal. No reproducible infrastructure setup exists. Another developer cloning the repo can't provision the required Azure resources without manual steps and tribal knowledge.

## Solution

Create `infra/main.bicep` (or Terraform) with:
- Azure SQL Server (serverless tier) + database
- Azure Functions App (Flex Consumption, Node.js 22)
- Application Insights for monitoring
- Managed Identity configuration (Functions → SQL, Functions → Graph)
- App Service Authentication (Easy Auth) with Entra ID
- Environment variable templates for local.settings.json and production
- Parameter files for dev/staging/production environments
