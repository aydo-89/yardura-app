import { Pool, PoolConfig, types, QueryResult, QueryResultRow } from "pg";

const POSTGIS_URL = process.env.POSTGIS_URL || process.env.POSTGIS_CONNECTION_STRING;
const DEFAULT_PORT = 5433;

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
}

function buildPoolConfig(): PoolConfig {
  if (POSTGIS_URL) {
    const ssl = (process.env.POSTGIS_SSL ?? process.env.PGSSLMODE ?? "").toLowerCase();
    // Add search_path to connection string - extensions must be first for PostGIS functions
    const urlWithSearchPath = POSTGIS_URL.includes('?') 
      ? `${POSTGIS_URL}&options=-c%20search_path%3Dextensions,geo,public`
      : `${POSTGIS_URL}?options=-c%20search_path%3Dextensions,geo,public`;
    const config: PoolConfig = {
      connectionString: urlWithSearchPath,
    };
    if (ssl === "require" || ssl === "true" || ssl === "1") {
      config.ssl = { rejectUnauthorized: false };
    }
    const connectTimeoutMs = Number(process.env.POSTGIS_CONNECT_TIMEOUT_MS ?? "4000");
    if (Number.isFinite(connectTimeoutMs) && connectTimeoutMs > 0) {
      config.connectionTimeoutMillis = connectTimeoutMs;
    }
    return config;
  }

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
  };
  const ssl = (process.env.POSTGIS_SSL ?? process.env.PGSSLMODE ?? "").toLowerCase();
  if (ssl === "require" || ssl === "true" || ssl === "1") {
    config.ssl = { rejectUnauthorized: false };
  }
  const connectTimeoutMs = Number(process.env.POSTGIS_CONNECT_TIMEOUT_MS ?? "4000");
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
      console.error("PostGIS pool error", err);
    });
  }
  return global.__yarduraPostgisPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: any[],
  options?: QueryOptions,
): Promise<QueryResult<T>> {
  const pool = getPool();
  if (options?.timeoutMs && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
    const queryConfig: any = {
      text: sql,
      values: params ?? [],
      query_timeout: options.timeoutMs,
    };
    return pool.query<T>(queryConfig);
  }
  return pool.query<T>(sql, params);
}

function describePool(): string {
  if (POSTGIS_URL) {
    return POSTGIS_URL;
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
