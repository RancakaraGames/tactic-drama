# TacTic Drama — backend setup

The website is hosted from GitHub Pages. This repository contains the app code; Supabase will provide the database, admin authentication, and online video storage.

## 1. Create a Supabase project
Create a project in Supabase and keep its project URL and **anon/publishable key** available for the app configuration. Never put a service-role key in browser code or commit it to GitHub.

## 2. Create the database and video bucket
Open **SQL Editor** in the Supabase dashboard, create a new query, paste the complete contents of `supabase/schema.sql`, and run it.

This creates:
- `dramas` and `episodes` tables
- `user_roles` for admin authorization
- A public-read `drama-videos` storage bucket (up to 500 MB per file)
- Row-level security policies: visitors can read published catalog data and videos; only an explicitly assigned admin can write or delete

## 3. Create the first admin
In Supabase Authentication, create the admin user. Copy that user's UUID from the Users page. In SQL Editor, run this statement after replacing the UUID:

```sql
insert into public.user_roles (user_id, role)
values ('PASTE-ADMIN-USER-UUID-HERE', 'admin');
```

Do not expose the admin password or service-role key.

## 4. Connect the website
The frontend still needs the project's URL and anon/publishable key to be configured, then the login and upload interface can be connected to this backend. Do not add the service-role key to any frontend file.

## Important
The current upload form is still a local preview. It does not upload files to Supabase yet. The SQL setup prepares the secure backend; the next code change will connect the app UI to it.
