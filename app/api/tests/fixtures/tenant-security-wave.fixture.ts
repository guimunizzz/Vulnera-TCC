/**
 * Cenário permanente para os canários independentes de tenant e equipe.
 * Cria identidades e recursos em dois tenants para provar escopo e efeitos no banco.
 * Consumido somente pelas suítes da wave de segurança multi-tenant.
 */

import { prisma } from "../../src/database/prisma.database";
import { seedApplication } from "./applications.fixture";
import { seedCompany } from "./companies.fixture";
import { seedPlan } from "./plans.fixture";
import { seedProject, seedProjectMember } from "./projects.fixture";
import { seedUser } from "./users.fixture";
import { seedVulnerability } from "./vulnerabilities.fixture";

export const TENANT_SECURITY_WAVE_PASSWORD = "tenant-security-wave-password";

export async function seedTenantSecurityWaveFixture(now: Date = new Date()) {
  const plan = await seedPlan({
    name: "TENANT-SECURITY-WAVE",
    maxApplications: 8,
    maxProjects: 6,
    includesRemediation: true,
  });
  const [companyA, companyB] = await Promise.all([
    seedCompany({ name: "Tenant Wave A", planId: plan.id }),
    seedCompany({ name: "Tenant Wave B", planId: plan.id }),
  ]);

  await prisma.subscription.createMany({
    data: [companyA, companyB].map((company) => ({
      companyId: company.id,
      planId: plan.id,
      status: "ACTIVE",
      startDate: now,
    })),
  });

  // Inserções concorrentes já produziram P2034 intermitente no MySQL de teste.
  const ownerA = await seedUser({ name: "Owner Wave A", email: "owner-a@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "OWNER" });
  const memberA = await seedUser({ name: "Member Wave A", email: "member-a@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "MEMBER" });
  const ownerB = await seedUser({ name: "Owner Wave B", email: "owner-b@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "OWNER" });
  const memberB = await seedUser({ name: "Member Wave B", email: "member-b@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "MEMBER" });
  const admin = await seedUser({ name: "Admin Tenant Wave", email: "admin@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "ADMIN" });
  const pentesterAssigned = await seedUser({ name: "Assigned Pentester Wave", email: "assigned@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "PENTESTER" });
  const pentesterUnassigned = await seedUser({ name: "Unassigned Pentester Wave", email: "unassigned@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "PENTESTER" });
  const legacyClient = await seedUser({ name: "Legacy Client Wave", email: "legacy@tenant-wave.local", password: TENANT_SECURITY_WAVE_PASSWORD, role: "CLIENT" });

  await prisma.user.update({
    where: { id: legacyClient.id },
    data: { legacyOnboardingAllowed: true },
  });

  const disabledMember = await seedUser({
    name: "Disabled Member Wave A",
    email: "disabled-member@tenant-wave.local",
    password: TENANT_SECURITY_WAVE_PASSWORD,
    role: "CLIENT",
    companyId: companyA.id,
    companyRole: "MEMBER",
  });
  await prisma.user.update({
    where: { id: disabledMember.id },
    data: {
      deactivatedAt: new Date(now.getTime() - 1_000),
      expoPushToken: "ExponentPushToken[disabled-wave-fixture]",
    },
  });

  const [applicationA, applicationAWithoutProject, applicationB] = await Promise.all([
    seedApplication({ name: "Tenant Wave A App", companyId: companyA.id, url: "https://a.tenant-wave.example" }),
    seedApplication({ name: "Tenant Wave A App Without Project", companyId: companyA.id, url: "https://a2.tenant-wave.example" }),
    seedApplication({ name: "Tenant Wave B App", companyId: companyB.id, url: "https://b.tenant-wave.example" }),
  ]);
  const [projectA, projectB] = await Promise.all([
    seedProject({ name: "Tenant Wave A Project", applicationId: applicationA.id, companyId: companyA.id, status: "IN_REVIEW" }),
    seedProject({ name: "Tenant Wave B Project", applicationId: applicationB.id, companyId: companyB.id, status: "IN_REVIEW" }),
  ]);
  await seedProjectMember(projectA.id, pentesterAssigned.id);

  const [vulnerabilityA, vulnerabilityB] = await Promise.all([
    seedVulnerability({
      projectId: projectA.id,
      applicationId: applicationA.id,
      companyId: companyA.id,
      createdBy: admin.id,
      title: "Tenant Wave A Sensitive Finding",
    }),
    seedVulnerability({
      projectId: projectB.id,
      applicationId: applicationB.id,
      companyId: companyB.id,
      createdBy: admin.id,
      title: "Tenant Wave B Sensitive Finding",
    }),
  ]);

  return {
    now,
    plan,
    companyA,
    companyB,
    ownerA,
    memberA,
    ownerB,
    memberB,
    admin,
    pentesterAssigned,
    pentesterUnassigned,
    legacyClient,
    disabledMember,
    anonymous: { authorization: undefined },
    applicationA,
    applicationAWithoutProject,
    applicationB,
    projectA,
    projectB,
    vulnerabilityA,
    vulnerabilityB,
  };
}
