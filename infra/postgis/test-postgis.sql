-- Test if PostGIS is installed and accessible
-- Run this in Supabase SQL Editor first

-- Check if PostGIS extension exists
SELECT extname, extversion, nspname 
FROM pg_extension 
JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid
WHERE extname = 'postgis';

-- Try to get PostGIS version
SELECT PostGIS_Version();

-- Check available types
SELECT typname, nspname
FROM pg_type 
JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
WHERE typname = 'geometry';









