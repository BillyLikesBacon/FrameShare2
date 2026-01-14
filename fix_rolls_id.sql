-- This script fixes the 'id' column in the 'rolls' table to have a default UUID value.
-- This prevents the "null value in column id ... violates not-null constraint" error.

BEGIN;

-- 1. Ensure the UUID extension is available (usually is, but good practice)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Alter the 'rolls' table to set the default value for 'id'
-- We use gen_random_uuid() which is standard for Postgres 13+.
-- If that fails, try uuid_generate_v4() from the uuid-ossp extension.
ALTER TABLE rolls ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Just in case, let's do the same for 'players' if it's missing
ALTER TABLE players ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. And 'games' (though games.id is usually provided manually in this app)
-- Note: games.id is now TEXT based on previous fix, so we don't set a UUID default for it.

COMMIT;
