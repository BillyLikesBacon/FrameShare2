-- Enable replication for Realtime on specific tables
-- This is required for clients to receive 'INSERT', 'UPDATE', 'DELETE' events

-- Add 'players' table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- Add 'rolls' table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE rolls;

-- Verify (optional, usually you'd inspect pg_publication_tables)
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
