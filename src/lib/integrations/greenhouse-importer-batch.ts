/**
 * Greenhouse Data Importer - Batch Version
 * 
 * Optimized version that imports data in batches and shows progress.
 * This prevents memory issues and allows you to see progress incrementally.
 */

import { PrismaClient } from '@prisma/client';
import { GreenhouseAPI } from './greenhouse';
import {
  mapGreenhouseJob,
  mapGreenhouseCandidate,
  mapGreenhouseApplication,
  mapGreenhouseStage,
  mapGreenhouseInterview,
} from './greenhouse-mapper';

const prisma = new PrismaClient();

export interface ImportStats {
  jobs: { created: number; updated: number; skipped: number };
  candidates: { created: number; updated: number; skipped: number };
  applications: { created: number; updated: number; skipped: number };
  stages: { created: number; updated: number; skipped: number };
  interviews: { created: number; updated: number; skipped: number };
  errors: Array<{ type: string; id: string; error: string }>;
}

const BATCH_SIZE = 500; // Process 500 items at a time

export async function importGreenhouseDataBatch(): Promise<ImportStats> {
  const stats: ImportStats = {
    jobs: { created: 0, updated: 0, skipped: 0 },
    candidates: { created: 0, updated: 0, skipped: 0 },
    applications: { created: 0, updated: 0, skipped: 0 },
    stages: { created: 0, updated: 0, skipped: 0 },
    interviews: { created: 0, updated: 0, skipped: 0 },
    errors: [],
  };

  try {
    const client = new GreenhouseAPI();
    
    // Get or create default organization and market
    const organization = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { name: 'Acme Talent' },
    });

    const market = await prisma.market.findFirst({ where: { slug: 'hq' } }) || await prisma.market.create({
      data: {
        name: 'HQ',
        slug: 'hq',
        organizationId: organization.id,
      },
    });

    // ===== IMPORT JOBS (small dataset, import all at once) =====
    console.log('📦 Fetching and importing Jobs...');
    const jobs = await client.getAllJobs();
    console.log(`   Found ${jobs.length} jobs`);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const mappedJob = mapGreenhouseJob(job);
        const existing = await prisma.job.findUnique({
          where: { greenhouseJobId: mappedJob.greenhouseJobId },
        });

        if (existing) {
          await prisma.job.update({
            where: { id: existing.id },
            data: {
              title: mappedJob.title,
              description: mappedJob.description,
              location: mappedJob.location,
              status: mappedJob.status,
            },
          });
          stats.jobs.updated++;
        } else {
          await prisma.job.create({
            data: {
              greenhouseJobId: mappedJob.greenhouseJobId,
              title: mappedJob.title,
              description: mappedJob.description,
              location: mappedJob.location,
              status: mappedJob.status,
              marketId: market.id,
            },
          });
          stats.jobs.created++;
        }
        
        if ((i + 1) % 10 === 0 || i === jobs.length - 1) {
          console.log(`   ✓ Processed ${i + 1}/${jobs.length} jobs`);
        }
      } catch (error: any) {
        stats.errors.push({
          type: 'job',
          id: String(job.id),
          error: error.message,
        });
      }
    }
    console.log(`✅ Jobs complete: ${stats.jobs.created} created, ${stats.jobs.updated} updated\n`);

    // ===== IMPORT CANDIDATES IN BATCHES =====
    console.log('👤 Fetching and importing Candidates...');
    console.log('   📥 This may take a while - fetching all candidates from Greenhouse...');
    const allCandidates = await client.getAllCandidates();
    console.log(`   ✓ Fetched ${allCandidates.length} candidates total`);
    console.log(`   📝 Processing in batches of ${BATCH_SIZE}...`);

    // Process in batches
    for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
      const batch = allCandidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allCandidates.length / BATCH_SIZE);
      
      console.log(`   Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, allCandidates.length)} of ${allCandidates.length})...`);

      // Process batch
      let batchSkipped = 0;
      let batchErrors = 0;
      for (const candidate of batch) {
        try {
          const mappedCandidate = mapGreenhouseCandidate(candidate);
          
          // Skip if no email (required field)
          if (!mappedCandidate.email || !mappedCandidate.email.trim()) {
            stats.candidates.skipped++;
            batchSkipped++;
            continue;
          }
          
          // Skip if no firstName or lastName (required fields)
          if (!mappedCandidate.firstName || !mappedCandidate.lastName) {
            stats.candidates.skipped++;
            batchSkipped++;
            continue;
          }
          
          const existing = await prisma.candidate.findUnique({
            where: { greenhouseCandidateId: mappedCandidate.greenhouseCandidateId },
          });

          if (existing) {
            await prisma.candidate.update({
              where: { id: existing.id },
              data: {
                email: mappedCandidate.email,
                firstName: mappedCandidate.firstName,
                lastName: mappedCandidate.lastName,
                phone: mappedCandidate.phone,
                resumeUrl: mappedCandidate.resumeUrl || existing.resumeUrl,
                linkedinUrl: mappedCandidate.linkedinUrl || existing.linkedinUrl,
                portfolioUrl: mappedCandidate.portfolioUrl || existing.portfolioUrl,
                street: mappedCandidate.street,
                city: mappedCandidate.city,
                state: mappedCandidate.state,
                country: mappedCandidate.country,
                postcode: mappedCandidate.postcode,
                notes: mappedCandidate.notes || existing.notes,
                tags: mappedCandidate.tags,
              },
            });
            stats.candidates.updated++;
          } else {
            await prisma.candidate.create({
              data: {
                greenhouseCandidateId: mappedCandidate.greenhouseCandidateId,
                email: mappedCandidate.email,
                firstName: mappedCandidate.firstName,
                lastName: mappedCandidate.lastName,
                phone: mappedCandidate.phone,
                resumeUrl: mappedCandidate.resumeUrl,
                linkedinUrl: mappedCandidate.linkedinUrl,
                portfolioUrl: mappedCandidate.portfolioUrl,
                street: mappedCandidate.street,
                city: mappedCandidate.city,
                state: mappedCandidate.state,
                country: mappedCandidate.country,
                postcode: mappedCandidate.postcode,
                notes: mappedCandidate.notes,
                tags: mappedCandidate.tags,
              },
            });
            stats.candidates.created++;
          }
        } catch (error: any) {
          stats.errors.push({
            type: 'candidate',
            id: String(candidate.id),
            error: error.message,
          });
          // Log first few errors for debugging
          if (stats.errors.length <= 5) {
            console.error(`   ⚠️  Error importing candidate ${candidate.id}: ${error.message}`);
          }
        }
      }

      console.log(`   ✓ Batch ${batchNum} complete: ${stats.candidates.created} created, ${stats.candidates.updated} updated, ${batchSkipped} skipped, ${batchErrors} errors so far`);
    }
    console.log(`\n✅ Candidates complete: ${stats.candidates.created} created, ${stats.candidates.updated} updated\n`);

    // ===== IMPORT APPLICATIONS IN BATCHES =====
    console.log('📋 Fetching and importing Applications...');
    console.log('   📥 This may take a while - fetching all applications from Greenhouse...');
    const allApplications = await client.getAllApplications();
    console.log(`   ✓ Fetched ${allApplications.length} applications total`);
    console.log(`   📝 Processing in batches of ${BATCH_SIZE}...`);

    // Process in batches
    for (let i = 0; i < allApplications.length; i += BATCH_SIZE) {
      const batch = allApplications.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allApplications.length / BATCH_SIZE);
      
      console.log(`   Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, allApplications.length)} of ${allApplications.length})...`);

      // Process batch
      for (const application of batch) {
        try {
          const mappedApp = mapGreenhouseApplication(application);
          
          // Find job
          const job = await prisma.job.findUnique({
            where: { greenhouseJobId: mappedApp.greenhouseJobId },
          });

          if (!job) {
            stats.applications.skipped++;
            continue;
          }

          // Find candidate
          const candidate = await prisma.candidate.findUnique({
            where: { greenhouseCandidateId: mappedApp.greenhouseCandidateId },
          });

          if (!candidate) {
            stats.applications.skipped++;
            continue;
          }

          // Get or create default stage
          let stage = await prisma.stage.findFirst({
            where: { jobId: job.id, isDefault: true },
          });

          if (!stage) {
            stage = await prisma.stage.create({
              data: {
                jobId: job.id,
                name: application.current_stage?.name || 'Application',
                order: 0,
                isDefault: true,
              },
            });
          }

          const existing = await prisma.application.findUnique({
            where: { greenhouseApplicationId: mappedApp.greenhouseApplicationId },
          });

          // Parse the applied_at date from Greenhouse
          const appliedAt = application.applied_at ? new Date(application.applied_at) : null;

          if (existing) {
            await prisma.application.update({
              where: { id: existing.id },
              data: {
                status: mappedApp.status,
                stageId: stage.id,
                appliedAt: appliedAt || existing.appliedAt, // Update if we have a date
              },
            });
            stats.applications.updated++;
          } else {
            await prisma.application.create({
              data: {
                greenhouseApplicationId: mappedApp.greenhouseApplicationId,
                jobId: job.id,
                candidateId: candidate.id,
                stageId: stage.id,
                status: mappedApp.status,
                source: 'GREENHOUSE',
                appliedAt, // Set the actual application date from Greenhouse
              },
            });
            stats.applications.created++;
          }
        } catch (error: any) {
          stats.errors.push({
            type: 'application',
            id: String(application.id),
            error: error.message,
          });
        }
      }

      console.log(`   ✓ Batch ${batchNum} complete: ${stats.applications.created} created, ${stats.applications.updated} updated so far`);
    }
    console.log(`\n✅ Applications complete: ${stats.applications.created} created, ${stats.applications.updated} updated\n`);

    // ===== IMPORT STAGES FOR EACH JOB =====
    console.log('📊 Importing Stages for jobs...');
    const allJobs = await prisma.job.findMany({
      where: { greenhouseJobId: { not: null } },
    });

    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      try {
        const stages = await client.getJobStages(Number(job.greenhouseJobId));
        
        for (const stage of stages) {
          try {
            const mappedStage = mapGreenhouseStage(stage, job.greenhouseJobId!);
            const existing = await prisma.stage.findFirst({
              where: {
                jobId: job.id,
                name: mappedStage.name,
              },
            });

            if (!existing) {
              await prisma.stage.create({
                data: {
                  jobId: job.id,
                  name: mappedStage.name,
                  order: mappedStage.order,
                  isDefault: mappedStage.isDefault,
                },
              });
              stats.stages.created++;
            } else {
              stats.stages.updated++;
            }
          } catch (error: any) {
            stats.errors.push({
              type: 'stage',
              id: String(stage.id),
              error: error.message,
            });
          }
        }
        
        if ((i + 1) % 10 === 0 || i === allJobs.length - 1) {
          console.log(`   ✓ Processed stages for ${i + 1}/${allJobs.length} jobs`);
        }
      } catch (error: any) {
        stats.errors.push({
          type: 'job-stages',
          id: job.id,
          error: error.message,
        });
      }
    }
    console.log(`✅ Stages complete: ${stats.stages.created} created, ${stats.stages.updated} updated\n`);

    // ===== IMPORT INTERVIEWS (in batches) =====
    console.log('📅 Importing Interviews...');
    const dbApplications = await prisma.application.findMany({
      where: { greenhouseApplicationId: { not: null } },
      take: 1000, // Limit to avoid too many API calls
    });

    console.log(`   Processing interviews for ${dbApplications.length} applications...`);
    
    for (let i = 0; i < dbApplications.length; i++) {
      const application = dbApplications[i];
      try {
        const interviews = await client.getApplicationInterviews(Number(application.greenhouseApplicationId));
        
        for (const interview of interviews) {
          try {
            const mappedInterview = mapGreenhouseInterview(interview);
            
            if (!mappedInterview.scheduledAt) continue;

            // Find interviewer (first interviewer)
            const interviewerEmail = interview.interviewers?.[0]?.email;
            let interviewer = null;
            if (interviewerEmail) {
              interviewer = await prisma.user.findUnique({
                where: { email: interviewerEmail },
              });
            }

            // Create interview
            await prisma.interview.upsert({
              where: {
                id: `gh-${interview.id}`,
              },
              create: {
                id: `gh-${interview.id}`,
                applicationId: application.id,
                interviewerId: interviewer?.id || application.candidateId, // Fallback
                scheduledAt: mappedInterview.scheduledAt,
                duration: mappedInterview.duration || 60,
                type: mappedInterview.type || 'PHONE_SCREEN',
                location: mappedInterview.location,
                meetingLink: mappedInterview.meetingLink || undefined,
              },
              update: {
                scheduledAt: mappedInterview.scheduledAt,
                duration: mappedInterview.duration || 60,
                type: mappedInterview.type || 'PHONE_SCREEN',
                location: mappedInterview.location,
                meetingLink: mappedInterview.meetingLink || undefined,
              },
            });
            stats.interviews.created++;
          } catch (error: any) {
            stats.errors.push({
              type: 'interview',
              id: String(interview.id),
              error: error.message,
            });
          }
        }
        
        if ((i + 1) % 100 === 0 || i === dbApplications.length - 1) {
          console.log(`   ✓ Processed ${i + 1}/${dbApplications.length} applications`);
        }
      } catch (error: any) {
        // Skip if interview fetch fails
      }
    }
    console.log(`✅ Interviews complete: ${stats.interviews.created} created\n`);

    return stats;
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

