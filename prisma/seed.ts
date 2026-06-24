import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient, UserRole, JobStatus, ApplicationStatus, InterviewType, TaskStatus, TaskPriority, ActivityType, HireRecommendation, OfferStatus, CompensationType, HiringTeamRole, EmploymentType, CandidateSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function randomDate(startDaysAgo: number, endDaysAgo: number): Date {
  const start = daysAgo(startDaysAgo);
  const end = daysAgo(endDaysAgo);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ── Data pools ───────────────────────────────────────────────────────────────

const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Daniel',
  'Emily', 'Matthew', 'Elizabeth', 'Sebastian', 'Sofia', 'Jack', 'Aria',
  'Owen', 'Scarlett', 'Michael', 'Grace', 'Aiden', 'Chloe', 'Samuel',
  'Penelope', 'David', 'Riley', 'Joseph', 'Layla', 'Carter', 'Zoey',
  'Jayden', 'Nora', 'John', 'Lily', 'Luke', 'Eleanor', 'Anthony',
  'Hannah', 'Isaac', 'Lillian', 'Gabriel', 'Addison', 'Julian', 'Aubrey',
  'Lincoln', 'Ellie', 'Joshua', 'Stella', 'Andrew', 'Natalie', 'Ryan',
  'Zoe', 'Nathan', 'Leah', 'Caleb', 'Hazel', 'Thomas', 'Violet',
  'Christian', 'Aurora', 'Hunter', 'Savannah', 'Connor', 'Audrey',
  'Eli', 'Brooklyn', 'Aaron', 'Bella', 'Landon', 'Claire', 'Adrian',
  'Skylar', 'Jonathan', 'Lucy', 'Nolan', 'Paisley', 'Cameron', 'Anna',
  'Leo', 'Caroline', 'Jeremiah', 'Genesis', 'Ezra', 'Kennedy', 'Max',
  'Kinsley', 'Josiah', 'Allison', 'Robert', 'Maya', 'Hudson', 'Sarah',
  'Dominic', 'Madelyn', 'Austin', 'Adeline', 'Levi', 'Alexa',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
  'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Turner', 'Phillips', 'Evans', 'Collins', 'Edwards',
  'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Peterson',
  'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Howard', 'Ward',
];

const cities = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA',
  'Dallas, TX', 'Austin, TX', 'Nashville, TN', 'Denver, CO',
  'Charlotte, NC', 'Portland, OR', 'Atlanta, GA', 'Miami, FL',
  'Seattle, WA', 'Boston, MA', 'Raleigh, NC', 'Minneapolis, MN',
];

const jobTitles = [
  { title: 'Story Coach', dept: 'Education' },
  { title: 'Senior Story Coach', dept: 'Education' },
  { title: 'Lead Curriculum Designer', dept: 'Education' },
  { title: 'Chess Education Specialist', dept: 'Education' },
  { title: 'After-School Program Coordinator', dept: 'Education' },
  { title: 'Summer Camp Director', dept: 'Education' },
  { title: 'Regional Market Manager', dept: 'Operations' },
  { title: 'Operations Coordinator', dept: 'Operations' },
  { title: 'Client Success Manager', dept: 'Sales' },
  { title: 'Enrollment Advisor', dept: 'Sales' },
  { title: 'Marketing Coordinator', dept: 'Marketing' },
  { title: 'Content Creator', dept: 'Marketing' },
  { title: 'Social Media Manager', dept: 'Marketing' },
  { title: 'Software Engineer', dept: 'Engineering' },
  { title: 'Product Designer', dept: 'Engineering' },
  { title: 'QA Engineer', dept: 'Engineering' },
  { title: 'Franchise Development Manager', dept: 'Franchise' },
  { title: 'Training Specialist', dept: 'Education' },
  { title: 'Tutor Recruiter', dept: 'People' },
  { title: 'HR Coordinator', dept: 'People' },
];

const stageNames = ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired'];

const interviewTypeMap: Record<string, InterviewType> = {
  'Phone Screen': InterviewType.PHONE_SCREEN,
  'Interview': InterviewType.VIDEO_INTERVIEW,
  'Offer': InterviewType.FINAL_INTERVIEW,
};

const activityTitles: Record<string, string[]> = {
  APPLICATION_CREATED: ['New application received', 'Candidate applied', 'Application submitted'],
  STAGE_CHANGE: ['Moved to Phone Screen', 'Advanced to Interview', 'Moved to Offer stage', 'Advanced to Hired'],
  EMAIL_SENT: ['Confirmation email sent', 'Interview invitation sent', 'Rejection email sent', 'Follow-up email sent'],
  NOTE_ADDED: ['Recruiter added a note', 'Hiring manager commented', 'Interview feedback noted'],
  INTERVIEW_SCHEDULED: ['Phone screen scheduled', 'Video interview scheduled', 'Final interview scheduled'],
  INTERVIEW_COMPLETED: ['Phone screen completed', 'Interview completed', 'Final round completed'],
  FEEDBACK_SUBMITTED: ['Scorecard submitted', 'Interview feedback submitted', 'Panel feedback submitted'],
  OFFER_CREATED: ['Offer drafted', 'Offer package created'],
  OFFER_SENT: ['Offer letter sent to candidate'],
  OFFER_ACCEPTED: ['Candidate accepted offer'],
};

const sources: CandidateSource[] = [
  CandidateSource.CAREER_PAGE, CandidateSource.LINKEDIN, CandidateSource.INDEED,
  CandidateSource.REFERRAL, CandidateSource.AGENCY, CandidateSource.OTHER,
];

// ── Main seed function ───────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting comprehensive seed...');

  // ── Clear existing data so re-seeding refreshes dates instead of duplicating ──
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    console.log(`🧹 Cleared ${tables.length} tables`);
  }

  const organizationId = 'acme-org';
  const passwordHash = await bcrypt.hash('changeme', 10);

  // ── Organization ──
  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: {
      id: organizationId,
      name: 'Acme Talent',
      careerSiteHeadline: 'Build the Future of Chess Education',
      careerSiteDescription: 'Join a team that makes learning chess magical for kids everywhere.',
      careerSitePrimaryColor: '#7C3AED',
    }
  });

  // ── Departments ──
  const deptNames = ['Education', 'Operations', 'Sales', 'Marketing', 'Engineering', 'Franchise', 'People'];
  const departments: Record<string, string> = {};
  for (const name of deptNames) {
    const dept = await prisma.department.upsert({
      where: { organizationId_name: { organizationId, name } },
      update: {},
      create: { name, organizationId },
    });
    departments[name] = dept.id;
  }

  // ── Offices ──
  const officeData = [
    { name: 'HQ - New York', location: 'New York, NY', timezone: 'America/New_York' },
    { name: 'Nashville Office', location: 'Nashville, TN', timezone: 'America/Chicago' },
    { name: 'Austin Office', location: 'Austin, TX', timezone: 'America/Chicago' },
    { name: 'Remote', location: 'Remote', timezone: 'America/Chicago' },
  ];
  const offices: string[] = [];
  for (const o of officeData) {
    const existing = await prisma.office.findFirst({ where: { organizationId, name: o.name } });
    if (existing) {
      offices.push(existing.id);
    } else {
      const office = await prisma.office.create({ data: { ...o, organizationId } });
      offices.push(office.id);
    }
  }

  // ── Markets ──
  const marketData = [
    { id: 'market-hq', name: 'HQ', slug: 'hq' },
    { id: 'market-eastside', name: 'Eastside', slug: 'eastside' },
    { id: 'market-westside', name: 'Westside', slug: 'westside' },
    { id: 'market-nashville', name: 'Nashville', slug: 'nashville' },
    { id: 'market-austin', name: 'Austin', slug: 'austin' },
    { id: 'market-miami', name: 'Miami', slug: 'miami' },
  ];
  for (const m of marketData) {
    await prisma.market.upsert({
      where: { id: m.id },
      update: { name: m.name, slug: m.slug },
      create: { ...m, organizationId },
    });
  }

  // ── Users (hiring team) ──
  const userData = [
    { id: 'user-hq-admin', email: 'hq.admin@acmetalent.com', firstName: 'Harper', lastName: 'Quinn', role: UserRole.HQ_ADMIN, marketIds: [] as string[] },
    { id: 'user-market-admin', email: 'eastside.admin@acmetalent.com', firstName: 'Orla', lastName: 'Knight', role: UserRole.MARKET_ADMIN, marketIds: ['market-eastside'] },
    { id: 'user-recruiter', email: 'recruiter@acmetalent.com', firstName: 'Riley', lastName: 'Rook', role: UserRole.RECRUITER, marketIds: ['market-hq', 'market-eastside', 'market-nashville'] },
    { id: 'user-recruiter-2', email: 'sam.recruiter@acmetalent.com', firstName: 'Sam', lastName: 'Chen', role: UserRole.RECRUITER, marketIds: ['market-westside', 'market-austin', 'market-miami'] },
    { id: 'user-hiring-mgr', email: 'hiring.manager@acmetalent.com', firstName: 'Morgan', lastName: 'Blake', role: UserRole.HIRING_MANAGER, marketIds: ['market-hq', 'market-nashville'] },
    { id: 'user-hiring-mgr-2', email: 'alex.manager@acmetalent.com', firstName: 'Alex', lastName: 'Rivera', role: UserRole.HIRING_MANAGER, marketIds: ['market-eastside', 'market-westside'] },
  ];

  for (const u of userData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, role: u.role },
      create: {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        passwordHash,
        organizationId,
      },
    });

    for (const marketId of u.marketIds) {
      await prisma.userMarket.upsert({
        where: { userId_marketId: { userId: u.id, marketId } },
        update: {},
        create: { userId: u.id, marketId },
      });
    }
  }

  // ── Jobs (20 jobs across markets, departments) ──
  console.log('📋 Creating jobs...');
  const jobIds: string[] = [];
  const jobStageMap: Record<string, { id: string; name: string; order: number }[]> = {};

  for (let i = 0; i < 20; i++) {
    const jt = jobTitles[i % jobTitles.length];
    const marketId = randomFrom(marketData).id;
    const status = i < 12 ? JobStatus.PUBLISHED : i < 16 ? JobStatus.CLOSED : JobStatus.DRAFT;
    const jobId = `job-${i + 1}`;

    await prisma.job.upsert({
      where: { id: jobId },
      update: { status },
      create: {
        id: jobId,
        title: jt.title,
        description: `We're looking for an exceptional ${jt.title} to join our ${jt.dept} team. This role involves working with our innovative chess-based curriculum to create magical learning experiences for children.`,
        location: randomFrom(cities),
        marketId,
        status,
        departmentId: departments[jt.dept],
        officeId: randomFrom(offices),
        employmentType: i < 15 ? EmploymentType.FULL_TIME : randomFrom([EmploymentType.PART_TIME, EmploymentType.CONTRACT]),
        requisitionId: `REQ-${100 + i}`,
        openDate: daysAgo(randomBetween(10, 90)),
      },
    });
    jobIds.push(jobId);

    // Stages for each job
    const stages: { id: string; name: string; order: number }[] = [];
    for (let s = 0; s < stageNames.length; s++) {
      const stageId = `stage-${jobId}-${s + 1}`;
      await prisma.stage.upsert({
        where: { jobId_order: { jobId, order: s + 1 } },
        update: { name: stageNames[s] },
        create: {
          id: stageId,
          jobId,
          name: stageNames[s],
          order: s + 1,
          isDefault: s === 0,
          defaultInterviewType: interviewTypeMap[stageNames[s]] || null,
        },
      });
      stages.push({ id: stageId, name: stageNames[s], order: s + 1 });
    }
    jobStageMap[jobId] = stages;

    // Hiring team for each published job
    if (status === JobStatus.PUBLISHED) {
      const recruiterId = randomFrom(['user-recruiter', 'user-recruiter-2']);
      const managerId = randomFrom(['user-hiring-mgr', 'user-hiring-mgr-2']);
      for (const member of [
        { userId: recruiterId, role: HiringTeamRole.RECRUITER },
        { userId: managerId, role: HiringTeamRole.HIRING_MANAGER },
      ]) {
        const existing = await prisma.jobHiringTeam.findFirst({
          where: { jobId, userId: member.userId, role: member.role },
        });
        if (!existing) {
          await prisma.jobHiringTeam.create({
            data: { jobId, ...member },
          });
        }
      }
    }
  }

  // ── Candidates (150 candidates) ──
  console.log('👥 Creating 150 candidates...');
  const candidateIds: string[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < 150; i++) {
    const fn = randomFrom(firstNames);
    const ln = randomFrom(lastNames);
    let email = `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`;
    let suffix = 1;
    while (usedEmails.has(email)) {
      email = `${fn.toLowerCase()}.${ln.toLowerCase()}${suffix}@example.com`;
      suffix++;
    }
    usedEmails.add(email);

    const candidateId = `candidate-${i + 1}`;
    await prisma.candidate.upsert({
      where: { id: candidateId },
      update: {},
      create: {
        id: candidateId,
        email,
        firstName: fn,
        lastName: ln,
        phone: `+1${randomBetween(200, 999)}${randomBetween(100, 999)}${randomBetween(1000, 9999)}`,
        city: randomFrom(cities).split(',')[0],
        state: randomFrom(cities).split(', ')[1],
        source: randomFrom(sources),
        tags: randomFrom([[], ['experienced'], ['new-grad'], ['referral', 'priority'], ['chess-player'], ['educator']]),
        linkedinUrl: Math.random() > 0.3 ? `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}` : null,
        notes: Math.random() > 0.7 ? 'Strong candidate, referred by team member.' : null,
        createdAt: randomDate(90, 0),
      },
    });
    candidateIds.push(candidateId);
  }

  // ── Applications (200+ applications spread across jobs and stages) ──
  console.log('📝 Creating 200+ applications...');
  const applicationIds: string[] = [];
  const appToJob: Record<string, string> = {};
  const appToStage: Record<string, string> = {};
  const usedCandidateJob = new Set<string>();

  // Distribute: most apps in Applied, decent funnel through stages
  const publishedJobs = jobIds.filter((_, i) => i < 12); // first 12 are published

  for (let i = 0; i < 220; i++) {
    const jobId = randomFrom(publishedJobs);
    const candidateId = randomFrom(candidateIds);
    const key = `${candidateId}-${jobId}`;
    if (usedCandidateJob.has(key)) continue;
    usedCandidateJob.add(key);

    const stages = jobStageMap[jobId];
    // Weighted stage distribution: 40% Applied, 25% Phone Screen, 20% Interview, 10% Offer, 5% Hired
    const rand = Math.random();
    let stageIdx: number;
    if (rand < 0.40) stageIdx = 0;
    else if (rand < 0.65) stageIdx = 1;
    else if (rand < 0.85) stageIdx = 2;
    else if (rand < 0.95) stageIdx = 3;
    else stageIdx = 4;

    const stage = stages[stageIdx];
    const status = stageIdx === 4 ? ApplicationStatus.HIRED :
      (Math.random() < 0.08 ? ApplicationStatus.REJECTED :
        (Math.random() < 0.03 ? ApplicationStatus.WITHDRAWN : ApplicationStatus.ACTIVE));

    const appId = `app-${i + 1}`;
    const createdAt = randomDate(60, stageIdx === 4 ? 5 : 0);
    const aiScore = Math.random() > 0.3 ? randomBetween(25, 98) : null;

    try {
      await prisma.application.upsert({
        where: { id: appId },
        update: {},
        create: {
          id: appId,
          jobId,
          candidateId,
          stageId: stage.id,
          status,
          source: randomFrom(['CAREER_PAGE', 'LINKEDIN', 'INDEED', 'REFERRAL', 'DIRECT']),
          aiScore,
          aiScoreBreakdown: aiScore ? {
            resumeFit: randomBetween(20, 100),
            answerCompleteness: randomBetween(30, 100),
            answerQuality: randomBetween(20, 100),
            experienceMatch: randomBetween(10, 100),
          } : undefined,
          aiScoredAt: aiScore ? daysAgo(randomBetween(0, 5)) : null,
          createdAt,
          appliedAt: createdAt,
        },
      });
      applicationIds.push(appId);
      appToJob[appId] = jobId;
      appToStage[appId] = stage.name;
    } catch {
      // Skip duplicate candidateId+jobId
      continue;
    }
  }

  console.log(`  Created ${applicationIds.length} applications`);

  // ── Scorecards (org-level templates) ──
  console.log('📊 Creating scorecard templates...');
  const scorecardId = 'scorecard-general';
  await prisma.interviewScorecard.upsert({
    where: { id: scorecardId },
    update: {},
    create: {
      id: scorecardId,
      name: 'General Interview Scorecard',
      type: InterviewType.VIDEO_INTERVIEW,
      organizationId,
      isDefault: true,
      criteria: [
        { id: 'c1', name: 'Communication Skills', weight: 25, scoringType: 'SCALE', required: true },
        { id: 'c2', name: 'Chess Knowledge', weight: 20, scoringType: 'SCALE', required: true },
        { id: 'c3', name: 'Teaching Ability', weight: 25, scoringType: 'SCALE', required: true },
        { id: 'c4', name: 'Energy & Enthusiasm', weight: 15, scoringType: 'SCALE', required: true },
        { id: 'c5', name: 'Culture Fit', weight: 15, scoringType: 'SCALE', required: true },
      ],
    },
  });

  const phoneScoreScorecardId = 'scorecard-phone';
  await prisma.interviewScorecard.upsert({
    where: { id: phoneScoreScorecardId },
    update: {},
    create: {
      id: phoneScoreScorecardId,
      name: 'Phone Screen Scorecard',
      type: InterviewType.PHONE_SCREEN,
      organizationId,
      criteria: [
        { id: 'p1', name: 'Availability & Schedule Fit', weight: 30, scoringType: 'SCALE', required: true },
        { id: 'p2', name: 'Motivation & Interest', weight: 35, scoringType: 'SCALE', required: true },
        { id: 'p3', name: 'Communication Clarity', weight: 35, scoringType: 'SCALE', required: true },
      ],
    },
  });

  // ── Interviews (80+ across pipeline) ──
  console.log('📅 Creating interviews...');
  const interviewIds: string[] = [];
  const interviewAppIds: string[] = [];
  let interviewCount = 0;

  for (const appId of applicationIds) {
    const stageName = appToStage[appId];
    // Only create interviews for candidates past Applied stage
    if (stageName === 'Applied') continue;
    if (Math.random() < 0.15) continue; // skip some for realism

    const interviewerIds = ['user-recruiter', 'user-recruiter-2', 'user-hiring-mgr', 'user-hiring-mgr-2'];
    const interviewerId = randomFrom(interviewerIds);
    const isPast = stageName !== 'Phone Screen' || Math.random() > 0.3;
    const scheduledAt = isPast ? randomDate(30, 1) : hoursFromNow(randomBetween(2, 168));
    const type = stageName === 'Phone Screen' ? InterviewType.PHONE_SCREEN :
      stageName === 'Offer' || stageName === 'Hired' ? InterviewType.FINAL_INTERVIEW :
        InterviewType.VIDEO_INTERVIEW;

    const interviewId = `interview-${interviewCount + 1}`;
    try {
      await prisma.interview.create({
        data: {
          id: interviewId,
          applicationId: appId,
          interviewerId,
          scheduledAt,
          duration: type === InterviewType.PHONE_SCREEN ? 30 : 45,
          type,
          location: type === InterviewType.PHONE_SCREEN ? 'Phone' : null,
          meetingLink: type !== InterviewType.PHONE_SCREEN ? `https://meet.google.com/abc-${interviewCount}` : null,
          scorecardId: type === InterviewType.PHONE_SCREEN ? phoneScoreScorecardId : scorecardId,
          recordingEnabled: type !== InterviewType.PHONE_SCREEN,
          confirmationSent: true,
          reminderSent: isPast,
        },
      });
      interviewIds.push(interviewId);
      interviewAppIds.push(appId);
      interviewCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${interviewIds.length} interviews`);

  // ── Interview Feedback / Scorecards (for past interviews) ──
  console.log('⭐ Creating interview feedback...');
  let feedbackCount = 0;
  for (let i = 0; i < interviewIds.length; i++) {
    // ~60% of interviews have feedback submitted
    if (Math.random() > 0.6) continue;

    const interviewId = interviewIds[i];
    const userId = randomFrom(['user-recruiter', 'user-hiring-mgr', 'user-recruiter-2', 'user-hiring-mgr-2']);
    const recommendation = randomFrom([
      HireRecommendation.STRONG_HIRE,
      HireRecommendation.HIRE,
      HireRecommendation.HIRE,
      HireRecommendation.NO_HIRE,
      HireRecommendation.STRONG_NO_HIRE,
    ]);

    try {
      await prisma.interviewFeedback.create({
        data: {
          interviewId,
          userId,
          scores: {
            c1: randomBetween(1, 5),
            c2: randomBetween(1, 5),
            c3: randomBetween(1, 5),
            c4: randomBetween(1, 5),
            c5: randomBetween(1, 5),
          },
          recommendation,
          strengths: randomFrom([
            'Excellent communicator with strong teaching instincts.',
            'Great energy, kids would love working with them.',
            'Deep chess knowledge combined with patience.',
            'Natural storyteller — perfect for our curriculum approach.',
            'Previous tutoring experience is a strong plus.',
          ]),
          weaknesses: randomFrom([
            'Could improve on time management during lessons.',
            'Limited chess experience beyond basics.',
            'Seemed nervous but may improve with training.',
            'No direct experience with children under 8.',
            null,
          ]),
          notes: randomFrom([
            'Would be a great fit for the afterschool program.',
            'Recommend fast-tracking to offer.',
            'Needs a second interview with the market manager.',
            'Good candidate but not urgent — revisit in 2 weeks.',
            null,
          ]),
          submittedAt: daysAgo(randomBetween(0, 20)),
        },
      });
      feedbackCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${feedbackCount} feedback entries`);

  // ── Offers (for candidates in Offer/Hired stage) ──
  console.log('💼 Creating offers...');
  let offerCount = 0;
  for (const appId of applicationIds) {
    const stageName = appToStage[appId];
    if (stageName !== 'Offer' && stageName !== 'Hired') continue;

    const status = stageName === 'Hired' ? OfferStatus.ACCEPTED :
      randomFrom([OfferStatus.SENT, OfferStatus.PENDING_APPROVAL, OfferStatus.DRAFT, OfferStatus.DECLINED]);

    try {
      await prisma.offer.create({
        data: {
          applicationId: appId,
          jobId: appToJob[appId],
          compensationType: randomFrom([CompensationType.HOURLY, CompensationType.SALARY]),
          hourlyRate: 25 + Math.random() * 20,
          currency: 'USD',
          employmentType: randomFrom(['CONTRACTOR', 'PART_TIME', 'FULL_TIME']),
          startDate: hoursFromNow(randomBetween(168, 720)),
          expiresAt: hoursFromNow(randomBetween(72, 336)),
          status,
          createdBy: randomFrom(['user-recruiter', 'user-hiring-mgr']),
          sentAt: status !== OfferStatus.DRAFT ? daysAgo(randomBetween(1, 10)) : null,
          acceptedAt: status === OfferStatus.ACCEPTED ? daysAgo(randomBetween(0, 5)) : null,
          declinedAt: status === OfferStatus.DECLINED ? daysAgo(randomBetween(0, 5)) : null,
        },
      });
      offerCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${offerCount} offers`);

  // ── Tasks ──
  console.log('✅ Creating tasks...');
  const taskTitles = [
    'Review resume', 'Schedule phone screen', 'Send follow-up email',
    'Check references', 'Prepare interview questions', 'Send rejection email',
    'Complete scorecard', 'Review application', 'Coordinate panel interview',
    'Update candidate status', 'Send offer letter', 'Conduct background check',
    'Onboarding prep', 'Schedule orientation', 'Send welcome packet',
  ];

  let taskCount = 0;
  for (let i = 0; i < 60; i++) {
    const appId = randomFrom(applicationIds);
    const assigneeId = randomFrom(['user-recruiter', 'user-recruiter-2', 'user-hiring-mgr', 'user-hiring-mgr-2']);
    const statusRand = Math.random();
    const taskStatus = statusRand < 0.4 ? TaskStatus.PENDING :
      statusRand < 0.55 ? TaskStatus.IN_PROGRESS :
        statusRand < 0.9 ? TaskStatus.COMPLETED : TaskStatus.CANCELLED;

    try {
      await prisma.task.create({
        data: {
          applicationId: appId,
          jobId: appToJob[appId],
          title: randomFrom(taskTitles),
          description: Math.random() > 0.5 ? 'Follow up on this item before end of week.' : null,
          assigneeId,
          status: taskStatus,
          priority: randomFrom([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT]),
          dueAt: randomFrom([hoursFromNow(-48), hoursFromNow(-12), hoursFromNow(24), hoursFromNow(72), hoursFromNow(168), null]),
          completedAt: taskStatus === TaskStatus.COMPLETED ? daysAgo(randomBetween(0, 10)) : null,
        },
      });
      taskCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${taskCount} tasks`);

  // ── Activity Log (rich recent activity) ──
  console.log('📜 Creating activity logs...');
  const activityTypes = Object.keys(activityTitles) as ActivityType[];
  let activityCount = 0;

  for (let i = 0; i < 300; i++) {
    const appId = randomFrom(applicationIds);
    const type = randomFrom(activityTypes);
    const title = randomFrom(activityTitles[type] || ['Activity recorded']);
    const userId = Math.random() > 0.2 ? randomFrom(['user-recruiter', 'user-recruiter-2', 'user-hiring-mgr', 'user-hiring-mgr-2', 'user-hq-admin']) : null;

    try {
      await prisma.activityLog.create({
        data: {
          applicationId: appId,
          type,
          title,
          description: Math.random() > 0.6 ? 'Automated action triggered by stage transition.' : null,
          userId,
          createdAt: randomDate(30, 0),
        },
      });
      activityCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${activityCount} activity logs`);

  // ── Stage History (for pipeline tracking / time-to-hire) ──
  console.log('📈 Creating stage history...');
  let stageHistoryCount = 0;
  for (const appId of applicationIds) {
    const jobId = appToJob[appId];
    const stages = jobStageMap[jobId];
    const currentStageName = appToStage[appId];
    const currentStageIdx = stageNames.indexOf(currentStageName);

    // Create history entries for each stage up to current
    let baseDate = randomDate(60, 30);
    for (let s = 0; s <= currentStageIdx; s++) {
      try {
        await prisma.stageHistory.create({
          data: {
            applicationId: appId,
            stageId: stages[s].id,
            movedAt: baseDate,
            movedBy: randomFrom(['user-recruiter', 'user-hiring-mgr', null]),
          },
        });
        stageHistoryCount++;
        // Add 2-7 days between stages
        baseDate = new Date(baseDate.getTime() + randomBetween(2, 7) * 24 * 60 * 60 * 1000);
      } catch {
        continue;
      }
    }
  }
  console.log(`  Created ${stageHistoryCount} stage history entries`);

  // ── Notes ──
  console.log('📝 Creating notes...');
  const noteContents = [
    'Strong first impression. Very articulate about teaching philosophy.',
    'Candidate has 3+ years tutoring experience. Promising.',
    'Discussed availability — flexible schedule, available weekends.',
    'References check out. Former employer spoke highly of them.',
    'Candidate seemed unsure about the role. May need follow-up.',
    'Great cultural fit. Mentioned they love working with kids.',
    'Resume looks solid but needs to verify chess credentials.',
    'Recommended by our Nashville market manager.',
    'Scheduling conflict — need to find alternative interview time.',
    'Candidate withdrew from consideration. Accepted another offer.',
  ];

  let noteCount = 0;
  for (let i = 0; i < 80; i++) {
    const appId = randomFrom(applicationIds);
    const authorId = randomFrom(['user-recruiter', 'user-recruiter-2', 'user-hiring-mgr', 'user-hiring-mgr-2']);
    try {
      await prisma.note.create({
        data: {
          applicationId: appId,
          authorId,
          content: randomFrom(noteContents),
          isPrivate: Math.random() < 0.2,
          createdAt: randomDate(30, 0),
        },
      });
      noteCount++;
    } catch {
      continue;
    }
  }
  console.log(`  Created ${noteCount} notes`);

  // ── Job Openings ──
  console.log('🏢 Creating job openings...');
  for (const jobId of publishedJobs) {
    const numOpenings = randomBetween(1, 4);
    for (let o = 0; o < numOpenings; o++) {
      const existing = await prisma.jobOpening.findFirst({
        where: { jobId, openingId: `${100 + o}` },
      });
      if (!existing) {
        await prisma.jobOpening.create({
          data: {
            jobId,
            openingId: `${100 + o}`,
            status: o === 0 && Math.random() < 0.3 ? 'FILLED' : 'OPEN',
            openDate: daysAgo(randomBetween(10, 60)),
            targetStartDate: hoursFromNow(randomBetween(168, 1440)),
          },
        });
      }
    }
  }

  // ── Summary ──
  console.log('\n✅ Seed completed successfully!');
  console.log(`  📋 ${jobIds.length} jobs`);
  console.log(`  👥 ${candidateIds.length} candidates`);
  console.log(`  📝 ${applicationIds.length} applications`);
  console.log(`  📅 ${interviewIds.length} interviews`);
  console.log(`  ⭐ ${feedbackCount} feedback entries`);
  console.log(`  💼 ${offerCount} offers`);
  console.log(`  ✅ ${taskCount} tasks`);
  console.log(`  📜 ${activityCount} activity logs`);
  console.log(`  📈 ${stageHistoryCount} stage history entries`);
  console.log(`  📝 ${noteCount} notes`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
