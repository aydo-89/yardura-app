-- Yardura Postgres Initialization Script
-- Generated for SQLite → Postgres Migration
--
-- This script creates the initial Postgres schema equivalent to the current SQLite schema
-- Run this script against your Postgres database to prepare for migration
--
-- Usage: psql -d your_database -f infra/pg/init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types (enums)
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'SALES_REP', 'ADMIN', 'TECH', 'OWNER');
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
CREATE TYPE "ServiceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ServiceType" AS ENUM ('REGULAR', 'ONE_TIME', 'SPRING_CLEANUP', 'DEODORIZATION');
CREATE TYPE "YardSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');
CREATE TYPE "Frequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'BI_WEEKLY', 'TWICE_WEEKLY');
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');
CREATE TYPE "DeodorizeMode" AS ENUM ('NONE', 'FIRST_VISIT', 'EACH_VISIT');
CREATE TYPE "AlertLevel" AS ENUM ('INFO', 'WATCH', 'ATTENTION');

-- Create tables

-- User accounts with authentication
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Sessions
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Users
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "salesRepId" TEXT,
    "commissionRate" DECIMAL(65,30),
    "orgId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Verification tokens
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("token")
);

-- Dog profiles
CREATE TABLE "Dog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "age" INTEGER,
    "weight" DECIMAL(65,30),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT,
    "customerId" TEXT,
    "samples" JSONB,

    CONSTRAINT "Dog_pkey" PRIMARY KEY ("id")
);

-- Service visits
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" "ServiceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "serviceType" "ServiceType" NOT NULL,
    "yardSize" "YardSize" NOT NULL,
    "dogsServiced" INTEGER NOT NULL,
    "accountNumber" TEXT,
    "notes" TEXT,
    "deodorize" BOOLEAN NOT NULL DEFAULT false,
    "litterService" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- Data readings from devices
CREATE TABLE "DataReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "dogId" TEXT,
    "serviceVisitId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DECIMAL(65,30),
    "volume" DECIMAL(65,30),
    "color" TEXT,
    "consistency" TEXT,
    "temperature" DECIMAL(65,30),
    "methaneLevel" DECIMAL(65,30),
    "location" TEXT,
    "deviceId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataReading_pkey" PRIMARY KEY ("id")
);

-- Global eco statistics
CREATE TABLE "GlobalStats" (
    "id" TEXT NOT NULL,
    "totalWasteDiverted" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalMethaneAvoided" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "totalDogs" INTEGER NOT NULL DEFAULT 0,
    "totalServiceVisits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalStats_pkey" PRIMARY KEY ("id")
);

-- Commission tracking
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceVisitId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- Multi-tenant organizations
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- Business customers
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Recurring jobs
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "frequency" "Frequency" NOT NULL DEFAULT 'WEEKLY',
    "nextVisitAt" TIMESTAMP(3),
    "dayOfWeek" INTEGER,
    "extraAreas" INTEGER NOT NULL DEFAULT 0,
    "deodorizeMode" "DeodorizeMode" NOT NULL DEFAULT 'NONE',
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- IoT devices
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- Waste analysis samples
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "customerId" TEXT,
    "dogId" TEXT,
    "jobId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,
    "weightG" DECIMAL(65,30),
    "moistureRaw" INTEGER,
    "temperatureC" DECIMAL(65,30),
    "gpsLat" DECIMAL(65,30),
    "gpsLng" DECIMAL(65,30),
    "notes" TEXT,
    "freshnessScore" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- Sample analysis scores
CREATE TABLE "SampleScore" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "colorLabel" TEXT,
    "consistencyLabel" TEXT,
    "contentFlags" TEXT,
    "hydrationHint" TEXT,
    "giCluster" TEXT,
    "confidence" DECIMAL(65,30),
    "baselineDelta" JSONB,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleScore_pkey" PRIMARY KEY ("id")
);

-- Health alerts
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "level" "AlertLevel" NOT NULL DEFAULT 'INFO',
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- Eco statistics per organization
CREATE TABLE "EcoStat" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT,
    "dogId" TEXT,
    "periodMonth" TEXT NOT NULL,
    "lbsDiverted" DECIMAL(65,30) NOT NULL,
    "methaneAvoidedCuFt" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcoStat_pkey" PRIMARY KEY ("id")
);

-- Billing snapshots
CREATE TABLE "BillingSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "pricePerVisitCents" INTEGER NOT NULL,
    "visitsPerMonth" INTEGER NOT NULL,
    "oneTimeFeeCents" INTEGER NOT NULL,
    "discountOneTimeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingSnapshot_pkey" PRIMARY KEY ("id")
);

-- Ground truth for ML training
CREATE TABLE "GroundTruth" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "colorLabel" TEXT,
    "consistency" TEXT,
    "contentFlags" TEXT,
    "freshness" TEXT,
    "notStool" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroundTruth_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");
CREATE UNIQUE INDEX "Device_uniqueId_key" ON "Device"("uniqueId");
CREATE UNIQUE INDEX "GroundTruth_sampleId_key" ON "GroundTruth"("sampleId");
CREATE UNIQUE INDEX "Commission_salesRepId_serviceVisitId_key" ON "Commission"("salesRepId", "serviceVisitId");

-- Performance indexes
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "User_salesRepId_idx" ON "User"("salesRepId");
CREATE INDEX "User_orgId_idx" ON "User"("orgId");
CREATE INDEX "Dog_userId_idx" ON "Dog"("userId");
CREATE INDEX "Dog_orgId_idx" ON "Dog"("orgId");
CREATE INDEX "Dog_customerId_idx" ON "Dog"("customerId");
CREATE INDEX "ServiceVisit_userId_idx" ON "ServiceVisit"("userId");
CREATE INDEX "DataReading_userId_idx" ON "DataReading"("userId");
CREATE INDEX "DataReading_dogId_idx" ON "DataReading"("dogId");
CREATE INDEX "DataReading_serviceVisitId_idx" ON "DataReading"("serviceVisitId");
CREATE INDEX "DataReading_deviceId_idx" ON "DataReading"("deviceId");
CREATE INDEX "Commission_salesRepId_idx" ON "Commission"("salesRepId");
CREATE INDEX "Commission_customerId_idx" ON "Commission"("customerId");
CREATE INDEX "Commission_serviceVisitId_idx" ON "Commission"("serviceVisitId");
CREATE INDEX "Customer_orgId_idx" ON "Customer"("orgId");
CREATE INDEX "Job_orgId_idx" ON "Job"("orgId");
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");
CREATE INDEX "Device_orgId_idx" ON "Device"("orgId");
CREATE INDEX "Sample_orgId_idx" ON "Sample"("orgId");
CREATE INDEX "Sample_deviceId_idx" ON "Sample"("deviceId");
CREATE INDEX "Sample_customerId_idx" ON "Sample"("customerId");
CREATE INDEX "Sample_dogId_idx" ON "Sample"("dogId");
CREATE INDEX "Sample_jobId_idx" ON "Sample"("jobId");
CREATE INDEX "Sample_orgId_capturedAt_idx" ON "Sample"("orgId", "capturedAt");
CREATE INDEX "Sample_customerId_capturedAt_idx" ON "Sample"("customerId", "capturedAt");
CREATE INDEX "Sample_dogId_capturedAt_idx" ON "Sample"("dogId", "capturedAt");
CREATE INDEX "SampleScore_sampleId_idx" ON "SampleScore"("sampleId");
CREATE INDEX "Alert_orgId_idx" ON "Alert"("orgId");
CREATE INDEX "Alert_sampleId_idx" ON "Alert"("sampleId");
CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");
CREATE INDEX "EcoStat_orgId_idx" ON "EcoStat"("orgId");
CREATE INDEX "EcoStat_orgId_periodMonth_idx" ON "EcoStat"("orgId", "periodMonth");
CREATE INDEX "BillingSnapshot_orgId_idx" ON "BillingSnapshot"("orgId");
CREATE INDEX "BillingSnapshot_orgId_customerId_idx" ON "BillingSnapshot"("orgId", "customerId");
CREATE INDEX "GroundTruth_dataset_split_idx" ON "GroundTruth"("dataset", "split");

-- Create foreign key constraints
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataReading" ADD CONSTRAINT "DataReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataReading" ADD CONSTRAINT "DataReading_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataReading" ADD CONSTRAINT "DataReading_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SampleScore" ADD CONSTRAINT "SampleScore_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroundTruth" ADD CONSTRAINT "GroundTruth_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default global stats record
INSERT INTO "GlobalStats" ("id", "totalWasteDiverted", "totalMethaneAvoided", "totalUsers", "totalDogs", "totalServiceVisits", "updatedAt")
VALUES ('global', 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;


