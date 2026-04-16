-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "attendanceLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendanceLockedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceLockedById" TEXT;

-- CreateTable
CREATE TABLE "attendance_session_edits" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "previousStartDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_session_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_session_edits_sectionId_idx" ON "attendance_session_edits"("sectionId");

-- CreateIndex
CREATE INDEX "attendance_session_edits_editedById_idx" ON "attendance_session_edits"("editedById");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_attendanceLockedById_fkey" FOREIGN KEY ("attendanceLockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_session_edits" ADD CONSTRAINT "attendance_session_edits_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_session_edits" ADD CONSTRAINT "attendance_session_edits_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
