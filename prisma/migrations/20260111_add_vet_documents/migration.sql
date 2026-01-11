-- Create CustomerVetDocument table
CREATE TABLE "CustomerVetDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dogId" TEXT,
    "documentUrl" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentType" TEXT,
    "visitDate" TIMESTAMP(3),
    "veterinarian" TEXT,
    "clinic" TEXT,
    "analysis" JSONB,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVetDocument_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "CustomerVetDocument_customerId_createdAt_idx" ON "CustomerVetDocument"("customerId", "createdAt");
CREATE INDEX "CustomerVetDocument_orgId_idx" ON "CustomerVetDocument"("orgId");
CREATE INDEX "CustomerVetDocument_dogId_idx" ON "CustomerVetDocument"("dogId");

-- Add foreign keys
ALTER TABLE "CustomerVetDocument" ADD CONSTRAINT "CustomerVetDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerVetDocument" ADD CONSTRAINT "CustomerVetDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerVetDocument" ADD CONSTRAINT "CustomerVetDocument_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
