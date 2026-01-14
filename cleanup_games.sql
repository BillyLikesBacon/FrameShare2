-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a daily job to delete games older than 24 hours
-- The job runs every day at midnight (0 0 * * *)
SELECT cron.schedule(
    'delete_old_games',
    '0 0 * * *',
    $$DELETE FROM games WHERE created_at < NOW() - INTERVAL '24 hours'$$
);

-- Note: This requires the pg_cron extension to be enabled in your database dashboard.
-- If pg_cron is not available, you can use a Row Level Security policy to restrict access,
-- but actual deletion would still need a trigger or external cron.
