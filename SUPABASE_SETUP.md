# TacTic Drama — backend setup

TacTic Drama is a mobile-first web app hosted on GitHub Pages. The live frontend is connected to Supabase for authentication, the public drama catalog, comments, reports, and video/poster storage.

## Live app

- Website: https://rancakaragames.github.io/tactic-drama/
- GitHub repository: https://github.com/RancakaraGames/tactic-drama

## How the app works

- Anyone can browse and watch published dramas without signing in.
- A viewer must create an account and sign in before uploading.
- A successful upload publishes the drama and episode immediately; there is no approval queue.
- Video uploads use resumable TUS transfers. The current video limit is 500 MB; supported formats are MP4, WebM, and MOV.
- Poster images are optional, up to 10 MB, in JPEG, PNG, or WebP.
- Signed-in users can report published videos. An admin can review reports and hide a reported drama.
- Public media buckets are used so viewers can stream without signing in. Do not upload private or confidential media.

## Existing Supabase connection

The frontend reads its public project URL and publishable key from `supabase-config.js`. A publishable key is intended for browser use; **never put a service-role or secret key in this file or in GitHub**.

The existing project has these buckets:
- `drama-videos` — public read, 500 MB maximum per file.
- `drama-posters` — public read, 10 MB maximum per file.

Storage upload paths are scoped to each signed-in user's UUID folder. The Storage policies also allow a user to delete only their own uploaded objects, which lets the app clean up files when publishing fails.

## Setting up a separate, new Supabase project

1. Create a Supabase project.
2. In SQL Editor, run the complete `supabase/schema.sql` file once. It creates the tables, RLS policies, buckets, and storage policies expected by the app.
3. Create an Auth user for the first administrator. Copy that user's UUID and insert it into `public.user_roles`:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('PASTE-ADMIN-USER-UUID-HERE', 'admin');
   ```

4. Put the new project's URL and publishable key in `supabase-config.js`. Never use a service-role key in the browser.
5. In Supabase Auth URL Configuration, set the Site URL to the GitHub Pages app URL and add that same URL as an allowed redirect URL.
6. Keep email confirmation enabled for normal public launch. Enable leaked-password protection in Auth password security settings.

**Do not run the setup SQL blindly on a live production project.** Review the existing schema and policies first, and back up important data before applying changes.

## Operational notes

- Uploads publish immediately, so use the report/takedown workflow to respond to abuse or copyright complaints.
- Reports are available to admins only. Assign admin access by adding the user's Auth UUID to `public.user_roles`.
- The app still needs real-device end-to-end testing with a confirmed account and a sample video. A successful GitHub Pages deployment does not by itself prove that sign-up, upload, playback, comments, and reports all work.
