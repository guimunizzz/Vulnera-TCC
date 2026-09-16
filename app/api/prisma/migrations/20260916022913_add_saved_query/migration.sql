-- CreateTable
CREATE TABLE `SavedQuery` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(400) NULL,
    `queryString` VARCHAR(2000) NOT NULL,
    `scope` VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    `ownerId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SavedQuery_companyId_scope_idx`(`companyId`, `scope`),
    INDEX `SavedQuery_ownerId_pinned_idx`(`ownerId`, `pinned`),
    UNIQUE INDEX `SavedQuery_ownerId_name_key`(`ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SavedQuery` ADD CONSTRAINT `SavedQuery_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedQuery` ADD CONSTRAINT `SavedQuery_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
