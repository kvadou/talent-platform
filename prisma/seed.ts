import { PrismaClient, UserRole, JobStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const organizationId = 'acme-org';

  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: {
      id: organizationId,
      name: 'Acme Talent'
    }
  });

  const markets = [
    { id: 'market-hq', name: 'HQ', slug: 'hq' },
    { id: 'market-eastside', name: 'Eastside', slug: 'eastside' },
    { id: 'market-westside', name: 'Westside', slug: 'westside' }
  ];

  for (const market of markets) {
    await prisma.market.upsert({
      where: { id: market.id },
      update: { name: market.name, slug: market.slug },
      create: { ...market, organizationId }
    });
  }

  const users = [
    {
      id: 'user-hq-admin',
      email: 'hq.admin@acmetalent.com',
      firstName: 'Harper',
      lastName: 'Queen',
      role: UserRole.HQ_ADMIN
    },
    {
      id: 'user-market-admin',
      email: 'eastside.admin@acmetalent.com',
      firstName: 'Orla',
      lastName: 'Knight',
      role: UserRole.MARKET_ADMIN,
      marketIds: ['market-eastside']
    },
    {
      id: 'user-recruiter',
      email: 'recruiter@acmetalent.com',
      firstName: 'Riley',
      lastName: 'Rook',
      role: UserRole.RECRUITER,
      marketIds: ['market-hq', 'market-eastside']
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { firstName: user.firstName, lastName: user.lastName, role: user.role },
      create: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        passwordHash: await bcrypt.hash('changeme', 10),
        organizationId
      }
    });

    if (user.marketIds) {
      for (const marketId of user.marketIds) {
        await prisma.userMarket.upsert({
          where: { userId_marketId: { userId: user.id, marketId } },
          update: {},
          create: { userId: user.id, marketId }
        });
      }
    }
  }

  const job = await prisma.job.upsert({
    where: { id: 'job-sample' },
    update: {
      status: JobStatus.PUBLISHED
    },
    create: {
      id: 'job-sample',
      title: 'Story Coach (HQ)',
      description: 'Teach kids chess through stories and play.',
      location: 'New York, NY',
      marketId: 'market-hq',
      status: JobStatus.PUBLISHED
    }
  });

  const stages = [
    { name: 'Applied', order: 1, isDefault: true },
    { name: 'Phone Screen', order: 2, isDefault: false },
    { name: 'Interview', order: 3, isDefault: false },
    { name: 'Offer', order: 4, isDefault: false },
    { name: 'Hired', order: 5, isDefault: false }
  ];

  for (const stage of stages) {
    await prisma.stage.upsert({
      where: { jobId_order: { jobId: job.id, order: stage.order } },
      update: { name: stage.name, isDefault: stage.isDefault },
      create: { ...stage, jobId: job.id }
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
