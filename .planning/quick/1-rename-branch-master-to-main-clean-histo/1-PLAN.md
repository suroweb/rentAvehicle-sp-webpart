---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: [RENAME-MASTER-TO-MAIN]

must_haves:
  truths:
    - "Local branch is named main with full 186-commit history intact"
    - "Remote origin has main as default branch"
    - "Remote origin no longer has master branch"
    - "All future pushes go to main"
  artifacts: []
  key_links:
    - from: "local main"
      to: "origin/main"
      via: "git push -u origin main"
      pattern: "branch main tracks origin/main"
---

<objective>
Rename the default branch from master to main on both local and GitHub remote, preserving all 186 commits of history.

Purpose: Align branch naming with modern Git conventions. The repo at github.com/suroweb/rentAvehicle-sp-webpart currently uses master as its sole branch.
Output: Local and remote both use main as default; master no longer exists anywhere.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Repository: /Users/dancomilosevici/DevLeet/Microsoft-365-Solutions/rentAvehicle-sp-webpart
Remote: origin -> https://github.com/suroweb/rentAvehicle-sp-webpart.git
Current state: single branch "master" with 186 commits, tracking remotes/origin/master
gh CLI status: NOT authenticated (git push works via cached credentials)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename local branch and push main to GitHub</name>
  <files></files>
  <action>
    Run the following commands in sequence:

    1. Rename local branch master to main:
       git branch -m master main

    2. Push main to GitHub and set upstream tracking:
       git push -u origin main

    3. Verify the push succeeded and tracking is correct:
       git branch -vv

    After this task, both master (remote) and main (remote) will exist on GitHub temporarily. That is expected -- master gets cleaned up after the default branch is changed.
  </action>
  <verify>
    git branch -vv shows "* main" tracking "origin/main", and git log --oneline | wc -l shows 186 commits
  </verify>
  <done>Local branch is "main", pushed to origin/main with full history, upstream tracking set</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Authenticate gh CLI (required for GitHub API operations)</name>
  <files></files>
  <action>
    CHECKPOINT: Human action required -- gh CLI is not authenticated.

    The local branch has been renamed to main and pushed to GitHub. Now we need gh CLI authentication to change the default branch on GitHub and delete the old master branch.

    Run in your terminal:
      gh auth login

    Select:
    - GitHub.com
    - HTTPS
    - Authenticate with browser (or paste a token)

    After authenticating, verify with:
      gh auth status
  </action>
  <verify>gh auth status shows "Logged in to github.com"</verify>
  <done>gh CLI is authenticated and can make API calls to github.com</done>
</task>

<task type="auto">
  <name>Task 3: Set main as default on GitHub and delete remote master</name>
  <files></files>
  <action>
    Run the following commands in sequence:

    1. Set main as the default branch on GitHub using the GitHub API via gh:
       gh api -X PATCH repos/suroweb/rentAvehicle-sp-webpart -f default_branch=main

    2. Delete the old master branch on the remote:
       git push origin --delete master

    3. Prune stale remote-tracking references:
       git fetch --prune

    4. Verify final state:
       git branch -a
       (should show only "* main" locally and "remotes/origin/main" remotely)

    If gh is still not authenticated, fall back to instructing the user to change the default branch manually at:
    https://github.com/suroweb/rentAvehicle-sp-webpart/settings (under "Default branch" section, click the swap icon next to master, select main, click Update).
    Then proceed with git push origin --delete master.
  </action>
  <verify>
    git branch -a shows only "* main" and "remotes/origin/main" -- no master references anywhere. gh repo view suroweb/rentAvehicle-sp-webpart --json defaultBranchRef -q .defaultBranchRef.name returns "main".
  </verify>
  <done>GitHub default branch is main, remote master branch is deleted, only main exists locally and remotely</done>
</task>

</tasks>

<verification>
1. git branch -a -- only main locally, only remotes/origin/main remotely
2. git log --oneline | wc -l -- 186 commits preserved
3. gh repo view suroweb/rentAvehicle-sp-webpart --json defaultBranchRef -q .defaultBranchRef.name -- returns "main"
4. git push (dry run) -- pushes to origin/main
</verification>

<success_criteria>
- Local branch named "main" with all 186 commits
- GitHub shows "main" as default branch
- No "master" branch exists on GitHub
- Upstream tracking: main -> origin/main
</success_criteria>

<output>
After completion, create `.planning/quick/1-rename-branch-master-to-main-clean-histo/1-SUMMARY.md`
</output>
