-- CreateTable
CREATE TABLE "PetFoodProduct" (
    "id" TEXT NOT NULL,
    "chewyId" TEXT,
    "chewyUrl" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FOOD',
    "ingredients" TEXT,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION,
    "autoshipPrice" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "lifestage" TEXT,
    "breedSize" TEXT,
    "specialDiets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetFoodProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetFoodProduct_chewyId_key" ON "PetFoodProduct"("chewyId");

-- CreateIndex
CREATE INDEX "PetFoodProduct_brand_idx" ON "PetFoodProduct"("brand");

-- CreateIndex
CREATE INDEX "PetFoodProduct_type_idx" ON "PetFoodProduct"("type");

-- CreateIndex
CREATE INDEX "PetFoodProduct_name_idx" ON "PetFoodProduct"("name");

-- CreateIndex
CREATE INDEX "PetFoodProduct_searchCount_idx" ON "PetFoodProduct"("searchCount");
