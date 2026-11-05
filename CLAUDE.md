@AGENTS.md

## Working directory

Work ONLY in the main project at `/Users/maximiliano/Documents/GLOVOX/glovox-data`.

- Do NOT use git worktrees.
- Do NOT create, read, or edit files under `.claude/worktrees/`.
- All reads, edits, and commands must target absolute paths inside `/Users/maximiliano/Documents/GLOVOX/glovox-data` (excluding `.claude/worktrees/`).
- If the session is started inside a worktree, ignore it and operate on the main project paths.

## Dashboard UI

Before building or modifying any dashboard component, read `docs/STYLE_DASHBOARD.md` in full.

## Publishing (push + deploy)

To push to `main`, always run `npm run ship`, never a bare `git push`. GitHub fails intermittently during its incidents: the push is rejected with a server error ("fatal error in …", HTTP 5xx), or it goes through but GitHub never notifies Vercel, so nothing deploys. `scripts/ship.mjs` runs `check:deploy`, retries only transient push errors, checks that Vercel registered a production deployment for that exact commit, creates it directly through the Vercel API if it has not appeared within 2 minutes (no extra commit, no dependency on GitHub's notification), waits for the build, and ends by saying whether production has the commit. If it stops because `origin/main` moved ahead, run `git pull --rebase` and run it again. If a push to `main` ever happened some other way, run `npm run ship -- --sha <commit>` to verify or unblock its deploy. Report the URL it prints as the proof that the change is live.