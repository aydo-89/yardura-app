-- Store reusable food products for quick logging
CREATE TABLE "CustomerFoodProduct" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "type" "FoodLogType" NOT NULL DEFAULT 'FOOD',
  "brand" TEXT,
  "productName" TEXT,
  "ingredients" TEXT,
  "notes" TEXT,
  "imagePath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerFoodProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerFoodProduct_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerFoodProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerFoodProduct_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CustomerFoodProduct_customerId_productName_idx" ON "CustomerFoodProduct"("customerId", "productName");
CREATE INDEX "CustomerFoodProduct_orgId_productName_idx" ON "CustomerFoodProduct"("orgId", "productName");
CREATE INDEX "CustomerFoodProduct_dogId_idx" ON "CustomerFoodProduct"("dogId");

-- Auto-log daily food schedules
CREATE TABLE "CustomerFoodSchedule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "productId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "timesOfDay" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "timeZone" TEXT,
  "startsOn" TIMESTAMP(3),
  "endsOn" TIMESTAMP(3),
  "lastGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerFoodSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerFoodSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerFoodSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerFoodSchedule_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CustomerFoodSchedule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CustomerFoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerFoodSchedule_customerId_active_idx" ON "CustomerFoodSchedule"("customerId", "active");
CREATE INDEX "CustomerFoodSchedule_orgId_active_idx" ON "CustomerFoodSchedule"("orgId", "active");
CREATE INDEX "CustomerFoodSchedule_dogId_idx" ON "CustomerFoodSchedule"("dogId");
CREATE INDEX "CustomerFoodSchedule_productId_idx" ON "CustomerFoodSchedule"("productId");

-- Link logs back to products
ALTER TABLE "CustomerFoodLog" ADD COLUMN "productId" TEXT;

CREATE INDEX "CustomerFoodLog_productId_idx" ON "CustomerFoodLog"("productId");

ALTER TABLE "CustomerFoodLog"
  ADD CONSTRAINT "CustomerFoodLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CustomerFoodProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
