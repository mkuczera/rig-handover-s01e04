---
name: firebase-review-preview
description: Publish and replace this repo's one-page public review preview with the signed-in Firebase Hosting CLI when Firebase is the chosen host.
---

# Firebase review preview

Use this when a plan calls for a public HTML copy and the human chooses Firebase Hosting. Keep
the preview and Firebase configuration outside this repository. Follow ADR 0003 and the plan's
review issue; a successful upload does not mean the reviewer has looked.

1. Confirm the approved Firebase project and Hosting site. Prefer a separate site, and put its
   explicit `site` ID in a temporary `firebase.json` so the project's default site is untouched.
   Creating a site or deploying needs the human's authorization under the course rules.

   ```json
   { "hosting": { "site": "SITE_ID", "public": "public" } }
   ```

2. Save the page as one self-contained HTML file in that temporary site's `public/` directory.
   Start rig with its local `.env` for the marked copy. Keep `.env`, the marker, and preview files
   out of Git, issues, and chat attachments.
3. From the temporary site directory, deploy with
   `firebase deploy --only hosting --project PROJECT_ID`. Fetch the returned HTTPS URL without
   signing in and compare the response byte for byte with the local HTML before sending the link.
4. Leave the review issue open while the reviewer waits. Once the reviewer confirms the look,
   close that issue. After the human approves replacement, restart rig without loading `.env`
   and with `LANE_MARKER` unset. Save the same route again; check that its banner reads
   `no marker set`.
5. Deploy the clean file to the **same site**. Fetch the same public URL again, compare it with
   the clean file, and verify the marker is absent. Only then close the clean-up issue when its
   other acceptance conditions hold.
6. If the site is no longer needed, ask before deleting it. Deleting a Hosting site is a separate
   outside action and should happen only after the course and human no longer need the link.

For a clean rig run, invoke `env -u LANE_MARKER ./node_modules/.bin/tsx src/server.ts` directly;
`pnpm start` loads `.env` and would restore the marker. Do not put any marker value in a shell
command or log.
