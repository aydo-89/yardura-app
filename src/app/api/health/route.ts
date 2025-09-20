import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const dbStatus = await checkDatabaseHealth();

    // Check Redis connectivity (if available)
    const redisStatus = await checkRedisHealth();

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Overall health status
    const isHealthy = dbStatus.healthy && redisStatus.healthy;
    const status = isHealthy ? "healthy" : "unhealthy";

    const healthData = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        responseTime: `${Date.now() - startTime}ms`,
      },
      { status: 503 },
    );
  }
}

async function checkDatabaseHealth() {
  try {
    // Test basic database connectivity
    const startTime = Date.now();
    await prisma.user.count();
    const responseTime = Date.now() - startTime;

    // Get some basic stats
    const userCount = await prisma.user.count();
    const serviceVisitCount = await prisma.serviceVisit.count();

    return {
      healthy: true,
      responseTime: `${responseTime}ms`,
      stats: {
        users: userCount,
        serviceVisits: serviceVisitCount,
      },
    };
  } catch (error) {
    console.error("Database health check failed:", error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown database error",
      responseTime: "N/A",
    };
  }
}

async function checkRedisHealth() {
  try {
    // Check if Redis is configured
    if (!process.env.REDIS_URL) {
      return {
        healthy: true,
        status: "not_configured",
        message: "Redis not configured (optional)",
      };
    }

    // Test Redis connectivity
    const redis = await import("redis");
    const client = redis.createClient({ url: process.env.REDIS_URL });

    const startTime = Date.now();
    await client.connect();
    await client.ping();
    await client.disconnect();
    const responseTime = Date.now() - startTime;

    return {
      healthy: true,
      responseTime: `${responseTime}ms`,
      status: "connected",
    };
  } catch (error) {
    console.error("Redis health check failed:", error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown Redis error",
      responseTime: "N/A",
      status: "disconnected",
    };
  }
}
