# Local refresh for sources that block GitHub's network

Coffeerem and Sezy return HTTP 403 to the scheduled GitHub job but answer normally from a home connection, and their robots.txt allows crawling. They are marked `runsFrom: 'local'` in `scrapers/src/roasters/configs.ts`. The scheduled job skips them, and `scripts/local-refresh.sh` crawls them nightly from the owner's Mac with the same crawler identity and pacing.

The scheduled job still goes red if one of them has had no successful crawl for three days, so a Mac that stops running is noticed.

## One-time setup

1. Create a Cloudflare API token with D1 edit permission for the account, then store it in the Keychain (the command prompts for it; nothing is echoed):
   `security add-generic-password -a kahvedrop -s kahvedrop-d1-token -w`
2. Keep a checkout dedicated to the job at `~/Documents/codex/coffeedb/runner` (a git worktree of this repo). The script moves it to `origin/main` before each run.
3. Load the launchd job `~/Library/LaunchAgents/net.kahvedrop.local-refresh.plist`, which runs the script daily at 04:30 local time and at the next wake if the Mac was asleep.

Log: `~/Library/Logs/kahvedrop-local-refresh.log`.

## Run it by hand

`~/Documents/codex/coffeedb/runner/scripts/local-refresh.sh`

## Moving a source back

Remove `runsFrom: 'local'` from its config once the shop accepts requests from GitHub again.
