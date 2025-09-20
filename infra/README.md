# Yardura Database Migration Infrastructure

This directory contains the complete infrastructure for migrating Yardura from SQLite to Postgres.

## Overview

The migration process is designed to be:
- **Safe**: Full backup and rollback capabilities
- **Gradual**: Feature flags control the migration process
- **Tested**: Comprehensive validation at each step
- **Monitored**: Detailed logging and progress tracking

## Directory Structure

```
infra/
├── pg/
│   └── init.sql          # Postgres schema initialization
├── migration/
│   ├── migrate.js        # Main migration orchestrator
│   ├── export-sqlite.js  # SQLite data export script
│   └── import-postgres.js # Postgres data import script
├── data/                 # Exported data files (generated)
└── README.md            # This file
```

## Prerequisites

1. **Environment Variables**: Add to your `.env` file:
   ```bash
   # Existing SQLite (keep as-is)
   DATABASE_URL="file:./prisma/dev.db"

   # New Postgres database
   POSTGRES_DATABASE_URL="postgresql://username:password@localhost:5432/yardura_prod"

   # Optional: Shadow database for migrations
   SHADOW_DATABASE_URL="postgresql://username:password@localhost:5432/yardura_shadow"
   ```

2. **Postgres Database**: Create a new Postgres database
   ```sql
   CREATE DATABASE yardura_prod;
   ```

3. **Node.js Dependencies**: Ensure pg is installed
   ```bash
   npm install pg
   ```

## Migration Process

### Phase 1: Export from SQLite

```bash
npm run migrate:export
```

This creates JSON files in `infra/data/` containing all your data:
- `user.json`, `account.json`, `session.json`
- `servicevisit.json`, `dog.json`, `datareading.json`
- `org.json`, `customer.json`, `job.json`
- And all other tables...

### Phase 2: Initialize Postgres

```bash
npm run migrate:import
```

This:
1. Runs the Postgres schema initialization script
2. Imports all data from JSON files
3. Validates the import process

### Phase 3: Full Migration

```bash
npm run migrate
```

This runs the complete migration process:
1. Prerequisites check
2. SQLite backup creation
3. Data export
4. Postgres initialization
5. Data import
6. Validation

### Phase 4: Validation Only

```bash
npm run migrate:validate
```

Compares record counts between SQLite and Postgres to ensure data integrity.

## Feature Flags

Control the migration process using environment variables:

```bash
# Enable Postgres usage
USE_POSTGRES=true

# Enable reads from Postgres (writes still go to SQLite)
READ_POSTGRES=true

# Enable writes to Postgres (full migration)
WRITE_POSTGRES=true

# Enable full migration mode (critical models move to Postgres)
MIGRATION_MODE=true
```

## Testing the Migration

### 1. Test Environment Setup

```bash
# Create a test Postgres database
createdb yardura_test

# Set test environment variables
export POSTGRES_DATABASE_URL="postgresql://localhost:5432/yardura_test"
export USE_POSTGRES=false  # Start with SQLite
```

### 2. Run Migration in Test Mode

```bash
npm run migrate
```

### 3. Test Feature Flags

```bash
# Test read-only mode
export READ_POSTGRES=true
export WRITE_POSTGRES=false

# Test write mode
export READ_POSTGRES=true
export WRITE_POSTGRES=true

# Full production mode
export USE_POSTGRES=true
```

### 4. Validate Application Behavior

1. **Quote Flow**: Ensure quote wizard works with both databases
2. **Client Portal**: Verify dashboard displays correct data
3. **API Endpoints**: Test all database-dependent endpoints
4. **Authentication**: Confirm NextAuth works with both databases

## Rollback Plan

If issues occur during migration:

### Immediate Rollback
```bash
# Switch back to SQLite
export USE_POSTGRES=false
export READ_POSTGRES=false
export WRITE_POSTGRES=false

# Restart application
npm run dev
```

### Complete Rollback
```bash
# Restore from backup
cp prisma/dev.db.backup-1234567890 prisma/dev.db

# Reset feature flags
export USE_POSTGRES=false
export READ_POSTGRES=false
export WRITE_POSTGRES=false
export MIGRATION_MODE=false
```

## Monitoring & Troubleshooting

### Migration Logs

All migration scripts produce detailed logs with timestamps:
```
✅ [2025-09-11T10:30:00.000Z] Starting data export from SQLite...
✅ [2025-09-11T10:30:05.000Z] Exported 1500 records from User...
✅ [2025-09-11T10:30:10.000Z] Data export completed successfully
```

### Common Issues

1. **Connection Failed**
   ```
   Error: POSTGRES_DATABASE_URL environment variable is required
   ```
   Solution: Set the `POSTGRES_DATABASE_URL` environment variable

2. **Permission Denied**
   ```
   Error: permission denied for database yardura_prod
   ```
   Solution: Grant proper permissions to the Postgres user

3. **Data Validation Failed**
   ```
   ❌ Migration validation failed - record counts do not match
   ```
   Solution: Check the import logs and re-run the import process

### Performance Considerations

- **Large Datasets**: Export/import happens in batches of 1000 records
- **Memory Usage**: Scripts process data in chunks to avoid memory issues
- **Network**: Ensure good connectivity for large data transfers

## Production Deployment

### Pre-Deployment Checklist

- [ ] Postgres database created and accessible
- [ ] Environment variables configured
- [ ] Backup of current SQLite database
- [ ] Migration tested in staging environment
- [ ] Rollback plan documented and tested

### Deployment Steps

1. **Create Backup**
   ```bash
   npm run migrate:export
   ```

2. **Initialize Production Postgres**
   ```bash
   npm run migrate:import
   ```

3. **Enable Read-Only Mode**
   ```bash
   export READ_POSTGRES=true
   # Deploy application
   ```

4. **Monitor Performance**
   - Check application logs
   - Monitor database performance
   - Validate data consistency

5. **Enable Write Mode**
   ```bash
   export WRITE_POSTGRES=true
   # Deploy application
   ```

6. **Full Migration**
   ```bash
   export USE_POSTGRES=true
   export MIGRATION_MODE=true
   # Deploy application
   ```

## Data Consistency Validation

After migration, validate that:

1. **Record Counts Match**
   ```sql
   -- SQLite
   SELECT COUNT(*) FROM User;

   -- Postgres
   SELECT COUNT(*) FROM "User";
   ```

2. **Critical Data Integrity**
   - User accounts and authentication
   - Service visits and scheduling
   - Customer and subscription data
   - Financial records (commissions, billing)

3. **Relationships Preserved**
   - Foreign key constraints
   - Data references between tables
   - Unique constraints and indexes

## Support

For migration issues:

1. Check the migration logs in `infra/data/`
2. Review the summary files:
   - `export-summary.json`
   - `import-summary.json`
3. Validate environment configuration
4. Test with smaller datasets first

## Next Steps

After successful migration:

1. **Update Application Code**: Remove SQLite-specific code
2. **Optimize Postgres**: Add indexes for query performance
3. **Monitoring**: Set up database monitoring and alerting
4. **Documentation**: Update deployment and maintenance docs

---

**Migration Infrastructure Complete** ✅
Ready for safe, gradual transition to Postgres


