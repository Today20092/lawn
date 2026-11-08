# Haithem Studio: Lawn video review

The video-review site for Haithem's YouTube team (fewer than 6 people). Haithem is the host and owner; Ayoub films, colour-grades and uploads graded masters to Google Drive; editors cut and do sound; one person makes thumbnails. Drive holds the masters and WhatsApp is the chat. A Plane board was tried and deleted; there is no board tool.

Live site: https://review.yahalausa.net (team `haithem-studio`).

## Code

- Based on **pingdotgg/lawn** (the maintained original). Remote `ping`; work branch `ping-main`, pushed to `origin` (`Today20092/lawn`) as `ping-free`.
- The earlier Snazzy Labs-based setup is kept on branch `codex/free-tier-setup` (not deployed).
- Our changes on top of Ping:
  - Billing disabled: `convex/billingHelpers.ts` always reports an active team; Stripe clients in `convex/billing.ts` load lazily so no Stripe keys are needed. Plan cards hidden in `app/routes/dashboard/-settings.tsx` (`SHOW_BILLING = false`).
  - Storage cap 100 GB (`FREE_STORAGE_LIMIT_BYTES`).
  - Every delete path (video, version, stack, folder, project, team) schedules `videoActions.purgeDeletedVideoStorage`, which deletes the R2 object and the Mux asset. Tests in `convex/videoVersions.vitest.ts`.
- To get upstream fixes: `git fetch ping && git merge ping/main`, then re-check the three changes above.

## Services and who owns them

| Piece | Job | Account |
|---|---|---|
| Cloudflare Worker `lawn-review` | Hosts the site on review.yahalausa.net | Haithem's Cloudflare (account `fb14df399f96dc019b8a82cb48788654`) |
| Cloudflare R2 bucket `lawn-review` | Original uploads | Haithem's Cloudflare. R2 Paid is on with his card; 10 GB free per account (shared with bucket `sink-yahalausa`), then $0.015/GB-month |
| Convex | Database and backend. Prod `fearless-retriever-665`, dev `merry-viper-590`, project `lawn-review` | Ayoub (ayoub.abedrabbo@gmail.com) |
| Clerk | Google sign-in. Prod instance on yahalausa.net (DNS CNAMEs in Haithem's zone), needs JWT template `convex` | Ayoub |
| Google OAuth client | For Clerk Google sign-in. GCP project `lawn-review`; consent screen still "Testing" | Ayoub |
| Mux | Transcodes and streams. Org Alphabravomedia, environment "Lawn", webhook `https://<convex-site>/webhooks/mux`. Free plan: 10 stored videos, no card | Ayoub |
| GitHub `Today20092/lawn` | Code | Ayoub |

Secrets live only in git-ignored `.env.local` (dev) and `.env.production.local` (prod web build), and in Convex env vars. Never print them.

## Deploy

```sh
npx convex deploy -y                      # prod backend
npx convex run --prod migrations:runAll   # Ping runs migrations each deploy
set -a; . ./.env.production.local; set +a
npx vite build --mode production
rm -rf .deploy-worker && cp -r dist/client .deploy-worker
rm -f .deploy-worker/_redirects && cp .deploy-worker/_shell.html .deploy-worker/index.html
CLOUDFLARE_ACCOUNT_ID=fb14df399f96dc019b8a82cb48788654 npx wrangler deploy -c deploy-worker.wrangler.jsonc
```

`deploy-worker.wrangler.jsonc` is git-ignored: Workers static assets from `.deploy-worker`, `not_found_handling: "single-page-application"`, custom domain route `review.yahalausa.net`. Don't let Wrangler auto-configure the project (it once rewrote `vite.config.ts` and `package.json` and broke the build).

Checks: `bun run typecheck`, `bun run typecheck:convex`, `bun run lint`, `npx vitest run`.

## Open items

- Empty test project "Cleanup test" in the team; delete it from the UI.
- Videos deleted before 2026-11-08 may have left files in R2 or Mux.
- Google OAuth consent screen is in "Testing".
- Team still needs inviting (Lawn Members); add Haithem as admin on Clerk and Convex.
- Harmless console warning: Geist Mono font preload 404 (upstream).
- Advice for the team: export review cuts as 1080p H.264 MP4 and delete approved cuts (Mux holds 10).
