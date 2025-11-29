-- Create FileObject table to align with Prisma schema
CREATE TABLE "FileObject" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "rootUid" TEXT NOT NULL,
  "fullPath" TEXT NOT NULL,
  "relativePath" TEXT NOT NULL,
  "parentPath" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDirectory" BOOLEAN NOT NULL DEFAULT FALSE,
  "size" INTEGER,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileObject_ownerId_rootUid_fullPath_key" ON "FileObject"("ownerId", "rootUid", "fullPath");
CREATE INDEX "FileObject_ownerId_rootUid_parentPath_idx" ON "FileObject"("ownerId", "rootUid", "parentPath");
