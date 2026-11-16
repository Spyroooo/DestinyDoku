# Community completion counters

The website stays on GitHub Pages. A separate Cloudflare Worker exposes `/weapons/daily` and `/weapons/practice`. D1 records one daily challenge completion per browser per Zurich calendar day, and every distinct completed Unlimited run. No player account is required. These are self-reported community counters, not verified leaderboards. Starting a run or submitting a wrong guess never reports a completion.

## Expanding an existing daily-counter database

No new database, bindings, or frontend URL is needed. Migration `0002_practice_counter.sql` adds `practice_completions`, `practice_totals`, and an atomic counting trigger. It leaves the existing daily tables and counts intact.

From the repository root, run these commands in order:

```sh
npx wrangler d1 migrations apply destinydoku-community --remote --config cloudflare/daily-counter/wrangler.jsonc
npm run counter:deploy
```

Wrangler applies only pending migrations. Run the migration before deploying the updated Worker. Then open `<your-worker-url>/weapons/practice`; the JSON should contain today's `dayKey` and a `count`. Finally commit/push the website changes for GitHub Pages to deploy. No remote migration or deployment is performed automatically by editing the code.

Unlimited rounds get a random `runId` at the start and a `completedAt` timestamp only on a correct guess. Both survive saved-game restoration. The server hashes each run ID and enforces uniqueness across all dates, so even a retry the next day cannot count it again. Different completed runs from the same browser each count once.

Completion timestamps determine the Zurich day of the count. Reports that fail are queued separately per run in localStorage, survive Play again/refresh, and retry when either Weapons mode is open. Delayed reports up to seven days old can update the original completion day's total; abandoned/unfinished runs do not queue anything. Legacy completed saves without an ID and completion time are not counted retroactively. The database does not store the raw run ID or browser IP for practice completions.

## What is already implemented

- Both modes display their own community count once the API is configured and responds successfully.
- A completion is submitted only after a win, including a restored win from the current day.
- Production browsers create a random UUID in localStorage. The Worker stores only a hash specific to that day; it does not store the raw UUID or IP address in D1.
- A database primary key deduplicates submissions. A trigger increments the total atomically, so refreshes, retries, multiple tabs, and StrictMode replays cannot double-count the same browser ID.
- The server independently checks Europe/Zurich's current date. Stale submissions are rejected. Old daily totals remain available in the database.
- The browser refreshes the displayed count every minute while visible and when returning to the tab. Failed submissions retry on the next refresh; acknowledged submissions become reads.
- If the API fails, the counter disappears and the game continues normally. If browser storage is unavailable, the count can still be read, but the browser does not report a completion.
- `npm run dev`, localhost production previews, and non-production hostnames never contact the API.
- Allowed browser origins are restricted to the production domain and its `www` variant. This is not authentication: someone deliberately forging requests or creating browser IDs can inflate the count. Basic write rate limiting reduces casual abuse.
- Cloudflare's limiter uses the request IP transiently (60 write attempts/minute/IP). It does not limit one completion per IP; players sharing university Wi-Fi can each count.

## Cloudflare setup

Run the commands below from the repository root. Wrangler is included as a development dependency, so `npm install` is enough if you haven't installed the updated dependencies yet. Nothing below requires changing the website's A/CNAME records.

1. Sign in to your Cloudflare account in your browser, then connect the CLI:

   ```sh
   npx wrangler login
   ```

2. Create the D1 database:

   ```sh
   npx wrangler d1 create destinydoku-community --config cloudflare/daily-counter/wrangler.jsonc
   ```

   Copy the returned `database_id`. Put it in `cloudflare/daily-counter/wrangler.jsonc`, replacing `00000000-0000-0000-0000-000000000000` in the existing `DB` binding. If Wrangler offers to add another binding, decline: the binding is already present. Keep `binding` as `DB` and `database_name` as `destinydoku-community`.

   Dashboard alternative for database creation: open **Storage & databases → D1 SQL Database → Create database**, use the same name, then copy its database ID. The CLI below still applies the schema and deploys the Worker.

3. Apply the database migration (creates two tables and the counter trigger):

   ```sh
   npx wrangler d1 migrations apply destinydoku-community --remote --config cloudflare/daily-counter/wrangler.jsonc
   ```

4. Validate and deploy the Worker:

   ```sh
   npm run counter:check
   npm run counter:deploy
   ```

   If this is your first Worker, Cloudflare may ask you to choose a `workers.dev` account subdomain. The deployed URL will look like:

   ```text
   https://destinydoku-daily-counter.YOUR-SUBDOMAIN.workers.dev
   ```

   Deploying with the included config connects the `DB` binding and write rate limiter automatically. Keep `ALLOWED_ORIGINS` as the included production URLs. The placeholder database ID must be replaced before deployment.

5. Open `<your-worker-url>/weapons/daily` in a browser. You should see JSON with today's Zurich `dayKey` and `count: 0`. This read does not add a completion. A later nonzero count is fine.

6. Put the Worker origin into `src/config/community.ts`:

   ```ts
   export const communityApiUrl: string = 'https://destinydoku-daily-counter.YOUR-SUBDOMAIN.workers.dev'
   ```

   Use the origin only, without `/weapons/daily`. The URL and D1 database ID are public configuration values. Do not put Cloudflare API tokens, passwords, or other credentials in frontend code or Git.

7. Run `npm test`, `npm run lint`, and `npm run build`, then commit/push the website changes to deploy through GitHub Actions. Worker deployments are separate: pushing the repository does not automatically deploy the Worker.

8. Test **on the live domain**: open Daily Weapons, complete it, check the count, and refresh. Reopening the same completed daily should not add another completion. Local development and preview builds intentionally hide the counter. An existing completed daily will report when the player next visits it; earlier visitors who don't return cannot be counted retroactively.

## What to send back

Only the D1 **database ID** (if not already configured) and the deployed **Worker URL** are needed to finish connecting the code. Neither is a secret. Login/authorization remains on your own device. No account API token is needed in this repository.

## Maintenance and costs

The Worker and D1 offer free usage allowances, but they have limits. Check Cloudflare usage before enabling paid billing; no paid service is required by this implementation. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Each read fetches one stored total instead of scanning all completion records. The Worker sends `Cache-Control: no-store`. Historical daily rows are retained; no scheduled midnight job is required. Resetting a browser ID or using another device can count as another player, which is accepted for this community metric.

Reference: [D1 setup](https://developers.cloudflare.com/d1/get-started/), [rate limiter binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
