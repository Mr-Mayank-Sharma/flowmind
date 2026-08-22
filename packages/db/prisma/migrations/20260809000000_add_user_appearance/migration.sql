-- AlterTable
ALTER TABLE "users" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN     "fontSize" TEXT NOT NULL DEFAULT 'Medium',
ADD COLUMN     "chatDensity" TEXT NOT NULL DEFAULT 'Comfortable';
