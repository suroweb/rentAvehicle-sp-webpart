---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements:
  - QUICK-3
must_haves:
  truths:
    - "README contains a 'Getting Started (Windows)' section immediately after the macOS section"
    - "Windows guide covers the same 8-step flow as macOS but with Windows-appropriate tooling"
    - "All shared steps (DB seed, dev identity, tenant secrets, API start, SPFx start, workbench) are identical or clearly adapted"
  artifacts:
    - path: "README.md"
      provides: "Windows Getting Started section"
      contains: "Getting Started (Windows)"
  key_links:
    - from: "Getting Started (Windows)"
      to: "Getting Started (macOS)"
      via: "Parallel structure in same README"
      pattern: "Getting Started \\(Windows\\)"
---

<objective>
Add a "Getting Started (Windows)" section to README.md that mirrors the existing macOS section, adapted for Windows tooling.

Purpose: Windows developers need a clear local dev setup guide. The macOS guide exists (8 steps); the Windows equivalent uses Docker Desktop, winget/npm for prerequisites, and PowerShell/cmd syntax where needed.
Output: Updated README.md with a complete Windows Getting Started section inserted between the macOS section and the Documentation section.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Getting Started (Windows) section to README.md</name>
  <files>README.md</files>
  <action>
Insert a new "## Getting Started (Windows)" section in README.md immediately after the macOS "Environment notes" subsection (after line 228, before the "---" that precedes "## Documentation").

The Windows section must mirror the macOS structure exactly (same step numbers, same headings) but adapted for Windows:

### Prerequisites
- Node.js 22 (LTS): `winget install OpenJS.NodeJS.LTS` or download from https://nodejs.org
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4 --unsafe-perm true` (alternatively: `winget install Microsoft.Azure.FunctionsCoreTools` or `choco install azure-functions-core-tools-4`)
- Microsoft 365 developer tenant with SharePoint admin access (same as macOS)
- Entra ID app registration -- link to docs/app-registration.md (same as macOS)

### 1. Install Docker Desktop
- Download and install Docker Desktop for Windows from https://docs.docker.com/desktop/install/windows-install/
- Ensure WSL 2 backend is enabled (Docker Desktop prompts for this during install)
- Note: Docker Desktop is the standard Docker runtime on Windows. Unlike macOS which can use the lightweight Colima alternative, Windows uses Docker Desktop directly.

### 2. Start the local database
- Same `docker run` command as macOS (identical -- Docker CLI is cross-platform)
- Same note about Azure SQL Edge and SA password

### 3. Seed the database
- Same commands: `cd api`, `npm install`, `node setup-db.js`
- Same description of what gets created

### 4. Configure your dev identity
- Same as macOS -- edit `dev.config.json` in project root
- Same JSON example, same explanation

### 5. Configure tenant secrets
- Same as macOS -- create `..\.rentavehicle\secrets.json` (use backslash in path note, but mention forward slashes work too in most contexts)
- Same JSON example
- Same "How configuration syncs" note

### 6. Start the API
- Same commands: `cd api`, `npm start`
- Same description

### 7. Start the SPFx workbench
- Same commands in a separate terminal: `cd spfx`, `npm install`, `npm run start`

### 8. Open the workbench
- Same two options (local and hosted workbench)
- Same URLs and query params
- Same note about `npx heft trust-dev-cert`

### Environment notes
- Same as macOS but replace the Colima/Docker note: "Local dev uses Azure SQL Edge on Docker Desktop (localhost:1433) with the sa account"
- Include all other notes (production link, contoso placeholder, role switching)

IMPORTANT formatting rules:
- Use the exact same markdown heading levels as macOS (## for section title, ### for subsections)
- Use the same admonition syntax (`> [!NOTE]`) for the certificate trust note
- Keep the "---" horizontal rule separators consistent with the rest of the README
- For steps that are IDENTICAL to macOS, use the same wording -- do not rephrase for the sake of being different. Only change what genuinely differs on Windows.
- Where commands differ, show the Windows command. Where commands are identical (npm, node, docker), keep them the same.
- Use PowerShell-compatible syntax in code blocks. Standard `cd`, `npm`, `node`, `docker` commands work identically in PowerShell and bash, so use ```bash for those. Only use ```powershell if showing a Windows-specific command.
  </action>
  <verify>
    grep -n "Getting Started (Windows)" README.md && grep -c "###" README.md | head -1
  </verify>
  <done>README.md contains a complete "Getting Started (Windows)" section with 8 numbered steps, Windows-specific prerequisites, Docker Desktop instructions, and all shared steps preserved. The section appears between the macOS section and the Documentation section.</done>
</task>

</tasks>

<verification>
- `grep "Getting Started (Windows)" README.md` returns the section heading
- `grep -c "winget\|Docker Desktop\|choco" README.md` shows Windows-specific tooling references
- The README renders correctly (section ordering: macOS -> Windows -> Documentation -> License)
- All 8 steps present: `grep "^### [0-9]" README.md` shows steps 1-8 appearing twice (once per OS)
</verification>

<success_criteria>
- README.md has a "Getting Started (Windows)" section with 8 steps
- Windows prerequisites use winget/npm (no Homebrew references)
- Docker Desktop replaces Colima
- All shared steps (3-8) preserve identical commands where applicable
- Section is correctly positioned after macOS, before Documentation
</success_criteria>

<output>
After completion, create `.planning/quick/3-add-getting-started-setup-guide-for-wind/3-SUMMARY.md`
</output>
