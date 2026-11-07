# Lawn team setup

Deploy this fork as a free-tier review app. Keep master files in Google Drive; upload only temporary review cuts to Lawn. Never commit credentials.

## Accounts

- GitHub: maintain this fork under the production owner's account.
- Convex: create a production deployment and deploy this project's backend.
- Clerk: create an application and enable Google sign-in. Add the Pages domain to allowed origins/redirects.
- Mux: create an API access token and webhook signing secret.
- Cloudflare: create an R2 bucket and Pages project. Pages build command: `bun run build`; output: `dist/client`.

## Environment

- **Pages build:** `VITE_CONVEX_URL` (Convex production URL) and `VITE_CLERK_PUBLISHABLE_KEY` (Clerk publishable key).
- **Convex:** `CLERK_JWT_ISSUER_DOMAIN` (Clerk JWT issuer URL); `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY`; R2 `RAILWAY_ENDPOINT`, `RAILWAY_ACCESS_KEY_ID`, `RAILWAY_SECRET_ACCESS_KEY`, `RAILWAY_BUCKET_NAME`, `RAILWAY_REGION`, and `R2_PUBLIC_URL` (or `RAILWAY_PUBLIC_URL`). Set the public URL to the R2 public/custom domain and configure bucket CORS for the Pages origin.
- Leave `STRIPE_*`, `NOTION_*`, `SNAZZY_API_KEY`, and `SELF_HOSTED_TRANSCODER` / `TRANSCODER_URL` unset for the agreed free setup. Confirm optional integrations are disabled before production.

For local work, store these values in an ignored `.env.local` file (Vite) and a separate ignored Convex env file, then use `bunx convex env set NAME VALUE` to set production values. Check `.gitignore` before creating a file. Never commit or paste secrets into chat. The app also requires the non-secret deployment values above; there is no additional Clerk secret key read directly by this source.

## Deploy and operate

1. Set the production Convex variables and deploy with `bunx convex deploy` from an authenticated shell.
2. Set Pages build variables and deploy the `dist/client` output. `public/_redirects` routes SPA paths to `/_shell.html`.
3. Configure the Mux webhook to the deployed Convex `/webhooks/mux` endpoint. Configure Clerk's Google OAuth redirect URI in Google Cloud Console.
4. Test sign-in, upload, timestamp comment, approval, and deletion using a short non-sensitive clip before inviting the team.
5. Mux free tier stores at most **10 videos**: keep only active review cuts and delete each asset after final approval. Check the Mux dashboard after deletion; do not assume removing a Lawn record also removed the Mux asset.

Cloud free-tier terms and limits can change. Verify current limits in each account before use.
