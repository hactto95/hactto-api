-- AlterTable
ALTER TABLE `post` ADD COLUMN `is_ai` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `post_lotto_round_category_is_ai_idx` ON `post`(`lotto_round`, `category`, `is_ai`);
