import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Plans
  const basicPlan = await prisma.plan.upsert({
    where: { name: "BASIC" },
    update: {},
    create: {
      name: "BASIC",
      maxApplications: 2,
      maxProjects: 1,
      includesRemediation: false,
      price: 499.0,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { name: "PRO" },
    update: {},
    create: {
      name: "PRO",
      maxApplications: 5,
      maxProjects: 3,
      includesRemediation: true,
      price: 1499.0,
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: "PRO_PLUS" },
    update: {},
    create: {
      name: "PRO_PLUS",
      maxApplications: 999,
      maxProjects: 999,
      includesRemediation: true,
      price: 0.0,
      isActive: true,
    },
  });

  // 2. Admin
  const adminHash = await bcrypt.hash("admin12345", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@vulnera.local" },
    update: {},
    create: {
      email: "admin@vulnera.local",
      password: adminHash,
      name: "Vulnera Admin",
      role: "ADMIN",
    },
  });

  // 3. TechNova
  const technova = await prisma.company.upsert({
    where: { cnpj: "00.000.000/0001-00" },
    update: {},
    create: {
      name: "TechNova Solutions",
      cnpj: "00.000.000/0001-00",
      planId: proPlan.id,
    },
  });

  // 4. Subscription ACTIVE
  const existingSub = await prisma.subscription.findFirst({
    where: { companyId: technova.id, status: "ACTIVE" },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        companyId: technova.id,
        planId: proPlan.id,
        status: "ACTIVE",
        startDate: new Date(),
        approvedBy: admin.id,
      },
    });
  }

  // 5. Owner da TechNova
  const ownerHash = await bcrypt.hash("demo12345", 12);
  await prisma.user.upsert({
    where: { email: "owner@technova.demo" },
    update: {},
    create: {
      email: "owner@technova.demo",
      password: ownerHash,
      name: "TechNova Owner",
      role: "CLIENT",
      companyId: technova.id,
      companyRole: "OWNER",
    },
  });

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
