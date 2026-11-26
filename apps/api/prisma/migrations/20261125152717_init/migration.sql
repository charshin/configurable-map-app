-- CreateEnum
CREATE TYPE "ConfigurationKind" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'PUBLISHED');

-- CreateTable
CREATE TABLE "datasets" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "layer_url" TEXT NOT NULL,
    "popup_template" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configurations" (
    "id" UUID NOT NULL,
    "dataset_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "owner_id" VARCHAR(40),
    "kind" "ConfigurationKind" NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "schema_version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configurations_dataset_id_visibility_created_at_idx" ON "configurations"("dataset_id", "visibility", "created_at" DESC);

-- CreateIndex
CREATE INDEX "configurations_dataset_id_owner_id_created_at_idx" ON "configurations"("dataset_id", "owner_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "configurations_one_default_per_dataset" ON "configurations"("dataset_id") WHERE ("is_default" = true);

-- AddForeignKey
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma's schema language can't express. Prisma doesn't manage
-- CHECK constraints, so they survive future `migrate dev` runs.

-- System configurations have no owner; custom ones always do.
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_owner_matches_kind"
  CHECK (("kind" = 'SYSTEM' AND "owner_id" IS NULL) OR ("kind" = 'CUSTOM' AND "owner_id" IS NOT NULL));

-- System configurations are always visible to everyone.
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_system_is_published"
  CHECK ("kind" = 'CUSTOM' OR "visibility" = 'PUBLISHED');

-- published_at is set exactly when the configuration is published.
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_published_at_matches_visibility"
  CHECK (("visibility" = 'PUBLISHED') = ("published_at" IS NOT NULL));

-- Only a system configuration can be the default.
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_default_is_system"
  CHECK (NOT "is_default" OR "kind" = 'SYSTEM');
