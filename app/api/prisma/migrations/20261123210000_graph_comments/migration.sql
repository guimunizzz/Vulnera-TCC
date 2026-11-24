-- ADR-061: comentários fixados em nós de grafo (Exposure Graph e CyberGraph do scan DAST).

-- CreateTable
CREATE TABLE `GraphComment` (
    `id` VARCHAR(191) NOT NULL,
    `graphKind` VARCHAR(16) NOT NULL,
    `scopeId` VARCHAR(64) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `nodeId` VARCHAR(200) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GraphComment_graphKind_scopeId_nodeId_idx`(`graphKind`, `scopeId`, `nodeId`),
    INDEX `GraphComment_companyId_idx`(`companyId`),
    INDEX `GraphComment_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GraphComment` ADD CONSTRAINT `GraphComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
