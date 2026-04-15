# Chat Archiving

This project now archives database chat rows from `Messages` into `ArchivedChats` using a nightly cron job.

## What Happens

- A cron job runs every night at `0 0 * * *`.
- It looks for rows in `Messages` older than 1 day.
- Those rows are copied into `ArchivedChats`.
- After a successful copy, the old rows are deleted from `Messages`.

This keeps the active `Messages` table small and faster to query.

## Files Added

- `models/archivedchat.js`
- `migrations/20260414180000-create-archived-chat.js`
- `services/chatArchiveService.js`
- `controllers/archiveController.js`
- `routes/archiveRoutes.js`

## Manual Test

You can trigger the archive job manually:

```http
POST /archive/run
Authorization: Bearer <token>
```

## Important

- Run your Sequelize migration so the `ArchivedChats` table exists.
- Run `npm install` so `node-cron` is available.
- The nightly cron job starts automatically after the database connection succeeds.
- You can override the timezone with `CRON_TIMEZONE` in `.env`.
