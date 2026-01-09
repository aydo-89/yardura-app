import { Pool, PoolConfig, types, QueryResult, QueryResultRow } from "pg";

/**
 * PostGIS connection pool optimized for geo queries.
 * 
 * CRITICAL: Uses DIRECT database connection (not pooler) for PostGIS queries.
 * The Supabase pooler (PgBouncer) adds ~10-15 seconds latency to geo queries
 * because it doesn't maintain the PostGIS extension search path properly.
 * Direct connection executes the same queries in ~100-200ms.
 * 
 * Priority order for connection URL:
 * 1. POSTGIS_URL - dedicated PostGIS connection (if separate DB)
 * 2. DIRECT_URL - direct Supabase connection (bypasses pooler)
 * 3. DATABASE_URL - fallback (may be pooler, slower for geo)
 */

// Prefer direct connection for PostGIS (10x faster than pooler for geo queries)
const getPostgisUrl = () => {
  return (
    process.env.POSTGIS_URL ||
    process.env.POSTGIS_CONNECTION_STRING ||
    process.env.DIRECT_URL ||  // Use direct connection for speed
    process.env.DATABASE_URL
  );
};

const DEFAULT_PORT = 5432;

type NumericParser = (value: string | null) => number | null;
type QueryOptions = { timeoutMs?: number };

const parseNumeric: NumericParser = (value) => {
  if (value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// Ensure numeric / float arrays come back as numbers, not strings
const NUMERIC_OID = 1700;
const FLOAT8_OID = 701;
const FLOAT4_OID = 700;

[NUMERIC_OID, FLOAT8_OID, FLOAT4_OID].forEach((oid) => {
  types.setTypeParser(oid, parseNumeric);
});

declare global {
  // eslint-disable-next-line no-var
  var __yarduraPostgisPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __yarduraPostgisPoolWarmedUp: boolean | undefined;
}

function buildPoolConfig(): PoolConfig {
  const POSTGIS_URL = getPostgisUrl();
  
  if (POSTGIS_URL) {
    const ssl = (process.env.POSTGIS_SSL ?? process.env.PGSSLMODE ?? "").toLowerCase();
    // Add search_path to connection string - extensions must be first for PostGIS functions
    // Also set statement_timeout to prevent runaway queries
    const separator = POSTGIS_URL.includes('?') ? '&' : '?';
    const urlWithOptions = `${POSTGIS_URL}${separator}options=-c%20search_path%3Dextensions,geo,public`;
    
    const config: PoolConfig = {
      connectionString: urlWithOptions,
      // Keep pool small but connections alive for fast queries
      max: 5,
      min: 1,
      idleTimeoutMillis: 60000, // Keep connections alive for 1 minute
    };
    
    // Enable SSL for Supabase/production connections
    if (
      ssl === "require" || 
      ssl === "true" || 
      ssl === "1" ||
      POSTGIS_URL.includes("supabase.co") ||
      POSTGIS_URL.includes("supabase.com")
    ) {
      config.ssl = { rejectUnauthorized: false };
    }
    
    const connectTimeoutMs = Number(process.env.POSTGIS_CONNECT_TIMEOUT_MS ?? "5000");
    if (Number.isFinite(connectTimeoutMs) && connectTimeoutMs > 0) {
      config.connectionTimeoutMillis = connectTimeoutMs;
    }
    return config;
  }

  // Fallback to individual env vars for local development
  const host = process.env.POSTGIS_HOST ?? process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = parseInt(process.env.POSTGIS_PORT ?? String(DEFAULT_PORT), 10);
  const database = process.env.POSTGIS_DB ?? process.env.POSTGRES_DB ?? "yardura_geo";
  const user = process.env.POSTGIS_USER ?? process.env.POSTGRES_USER ?? "yardura";
  const password = process.env.POSTGIS_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? "yardura_geo_password";

  const config: PoolConfig = {
    host,
    port,
    database,
    user,
    password,
    max: 5,
    min: 1,
    idleTimeoutMillis: 60000,
  };
  const ssl = (process.env.POSTGIS_SSL ?? process.env.PGSSLMODE ?? "").toLowerCase();
  if (ssl === "require" || ssl === "true" || ssl === "1") {
    config.ssl = { rejectUnauthorized: false };
  }
  const connectTimeoutMs = Number(process.env.POSTGIS_CONNECT_TIMEOUT_MS ?? "5000");
  if (Number.isFinite(connectTimeoutMs) && connectTimeoutMs > 0) {
    config.connectionTimeoutMillis = connectTimeoutMs;
  }
  return config;
}

function getPool(): Pool {
  if (!global.__yarduraPostgisPool) {
    const config = buildPoolConfig();
    global.__yarduraPostgisPool = new Pool(config);
    global.__yarduraPostgisPool.on("error", (err) => {
      // Log but don't crash - pool will recover
      console.error("PostGIS pool error (will retry):", err.message);
    });
    
    // Log which connection we're using (helpful for debugging)
    const url = getPostgisUrl();
    const isDirectConnection = url?.includes("db.") && url?.includes("supabase.co");
    const isPooler = url?.includes("pooler.supabase.com");
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[PostGIS] Using ${isDirectConnection ? "DIRECT" : isPooler ? "POOLER (slow!)" : "custom"} connection`
      );
    }
  }
  return global.__yarduraPostgisPool;
}

/**
 * Warm up the PostGIS connection pool.
 * Call this on server startup to pre-establish connections.
 * This eliminates the ~500ms cold-start penalty on the first geo query.
 */
export async function warmupPostgisPool(): Promise<void> {
  if (global.__yarduraPostgisPoolWarmedUp) return;
  
  try {
    const pool = getPool();
    // Simple query to establish connection and verify PostGIS works
    await pool.query("SELECT 1 as ping");
    global.__yarduraPostgisPoolWarmedUp = true;
    console.log("[PostGIS] Pool warmed up successfully");
  } catch (err) {
    console.error("[PostGIS] Pool warmup failed:", err);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: any[],
  options?: QueryOptions,
): Promise<QueryResult<T>> {
  const pool = getPool();
  
  // Set statement timeout for individual queries
  const timeoutMs = options?.timeoutMs;
  if (timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    const queryConfig: any = {
      text: sql,
      values: params ?? [],
      query_timeout: timeoutMs,
    };
    return pool.query<T>(queryConfig);
  }
  
  return pool.query<T>(sql, params);
}

function describePool(): string {
  const POSTGIS_URL = getPostgisUrl();
  if (POSTGIS_URL) {
    // Mask password in URL for logging
    try {
      const url = new URL(POSTGIS_URL);
      if (url.password) url.password = "***";
      return url.toString();
    } catch {
      return POSTGIS_URL.replace(/:[^:@]+@/, ":***@");
    }
  }
  const host = process.env.POSTGIS_HOST ?? process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = parseInt(process.env.POSTGIS_PORT ?? String(DEFAULT_PORT), 10);
  const database = process.env.POSTGIS_DB ?? process.env.POSTGRES_DB ?? "yardura_geo";
  const user = process.env.POSTGIS_USER ?? process.env.POSTGRES_USER ?? "yardura";
  return `${user}@${host}:${port}/${database}`;
}

export function getPostgisPool(): Pool {
  return getPool();
}

export async function closePostgisPool(): Promise<void> {
  if (global.__yarduraPostgisPool) {
    await global.__yarduraPostgisPool.end().catch((err) => {
      console.error("Failed to close PostGIS pool", err);
    });
    global.__yarduraPostgisPool = undefined;
  }
}

export function describePostgisPool(): string {
  return describePool();
}
