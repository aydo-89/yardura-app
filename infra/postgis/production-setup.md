# PostGIS Production Setup Guide

## Overview

Yardura uses a **separate PostGIS database** for geospatial operations (ZIP codes, places, counties) alongside the main Supabase database for application data.

## Prerequisites

### 1. Supabase PostGIS Extension (Main Database)

Your main Supabase database needs PostGIS enabled for any spatial queries:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Database** → **Extensions**
4. Search for and enable:
   - ✅ `postgis`
   - ✅ `postgis_topology` (optional)
   - ✅ `pg_trgm` (for fuzzy text search)

### 2. Separate PostGIS Database

You need a dedicated PostGIS database for geospatial data. Options:

#### Option A: Use Supabase (Recommended for simplicity)
- Use the same Supabase instance
- Create schemas: `geo` and `admin`
- Set environment variables to point to Supabase

#### Option B: Separate PostgreSQL Server
- Deploy a separate PostgreSQL instance with PostGIS
- Better for high-volume geo queries
- More complex setup

## Environment Variables

Add these to your **production** `.env` file on the server:

```bash
# Main Database (already configured)
DATABASE_URL="postgresql://postgres.xyhnxaukpoftldcfldxx:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true"

# PostGIS Database (for geo data)
POSTGIS_HOST="aws-1-us-east-2.pooler.supabase.com"  # or your separate PostGIS server
POSTGIS_PORT="6543"  # or 5432 for direct connection
POSTGIS_DB="postgres"  # your database name
POSTGIS_USER="postgres.xyhnxaukpoftldcfldxx"  # or your username
POSTGIS_PASSWORD="your-password-here"  # your password

# Alternative: Use single connection string
POSTGIS_URL="postgresql://user:password@host:port/database"
```

## Deployment Steps

### Step 1: Initialize PostGIS Extension

SSH into your production server and run:

```bash
cd /var/www/yardura.com

# Test PostGIS connection
npx tsx scripts/geo/test-postgis-connection.ts

# If successful, run init script
psql "$POSTGIS_URL" -f infra/postgis/init.sql
```

Or manually in Supabase SQL Editor:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS admin;

-- Create metadata table
CREATE TABLE IF NOT EXISTS admin.dataset_version (
  dataset_name TEXT PRIMARY KEY,
  source_url TEXT,
  version TEXT,
  loaded_at TIMESTAMPTZ DEFAULT now()
);
```

### Step 2: Run Migrations

```bash
cd /var/www/yardura.com

# Run all pending PostGIS migrations
npx tsx scripts/geo/run-migrations.ts

# Check migration status
npx tsx scripts/geo/migration-status.ts
```

### Step 3: Import Geographic Data

If you need to import ZIP codes, places, and counties:

```bash
# Import ZCTAs (ZIP Code Tabulation Areas)
npx tsx scripts/geo/etl/import-zcta.ts

# Import places (cities)
npx tsx scripts/geo/etl/import-places.ts

# Import counties
npx tsx scripts/geo/etl/import-counties.ts

# Enrich with population data
npx tsx scripts/geo/etl/enrich-all-population.ts
```

### Step 4: Update Deployment Script

Add PostGIS environment check to `deploy.sh`:

```bash
# After line 142 (before "Deployment complete")
echo '🗺️  Running PostGIS migrations...'
npx tsx scripts/geo/run-migrations.ts || true
```

## Verification

### Test PostGIS Connection

```bash
ssh -i ~/.ssh/id_ed25519 root@159.223.197.13
cd /var/www/yardura.com
npx tsx scripts/geo/test-postgis-connection.ts
```

### Check Tables

```sql
-- List geo tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'geo';

-- Check ZCTA count
SELECT COUNT(*) FROM geo.zcta;

-- Check places count
SELECT COUNT(*) FROM geo.place;
```

### Test API Endpoints

```bash
# Test ZIP search API
curl -X POST https://www.getinsightscoop.com/api/geo/zip-search \
  -H "Content-Type: application/json" \
  -d '{"city": "Minneapolis", "state": "MN", "searchType": "city"}'
```

## Troubleshooting

### Issue: PostGIS extension not found

**Solution:** Enable PostGIS in Supabase Dashboard → Extensions

### Issue: Connection refused

**Solution:** Check firewall rules and connection string. Supabase requires SSL:
```bash
POSTGIS_URL="postgresql://user:password@host:port/database?sslmode=require"
```

### Issue: Permission denied on schema

**Solution:** Grant permissions:
```sql
GRANT ALL ON SCHEMA geo TO your_user;
GRANT ALL ON SCHEMA admin TO your_user;
```

### Issue: Missing geographic data

**Solution:** Import data using ETL scripts:
```bash
npx tsx scripts/geo/etl/import-zcta.ts
npx tsx scripts/geo/etl/import-places.ts
```

## Production Checklist

- [ ] PostGIS extension enabled on Supabase
- [ ] Environment variables set on production server
- [ ] `infra/postgis/init.sql` executed
- [ ] PostGIS migrations run (`scripts/geo/run-migrations.ts`)
- [ ] Geographic data imported (ZCTAs, places, counties)
- [ ] API endpoints tested
- [ ] Deployment script updated

## Performance Tips

1. **Connection Pooling**: Use PgBouncer for connection pooling
2. **Indexes**: Ensure GIST indexes exist on geometry columns
3. **Simplified Geometries**: Use `geom_simplified` for map display
4. **Caching**: Cache frequent geo queries at application level

## Backup & Recovery

```bash
# Backup geo schema
pg_dump -h host -U user -d database -n geo -n admin > geo_backup.sql

# Restore geo schema
psql -h host -U user -d database < geo_backup.sql
```









