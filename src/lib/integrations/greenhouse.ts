/**
 * Greenhouse Harvest API Client
 * 
 * Comprehensive data extraction from Greenhouse using the Harvest API.
 * Extracts all possible data points: jobs, candidates, applications, stages, interviews, users, etc.
 */

interface GreenhouseJob {
  id: number;
  name: string;
  requisition_id: string | null;
  notes: string | null;
  status: 'open' | 'closed' | 'draft';
  confidential: boolean;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  closed_at: string | null;
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string; location: { name: string } | null }>;
  custom_fields: Record<string, any>;
  keyed_custom_fields: Record<string, any>;
  hiring_team: {
    hiring_managers?: Array<{ id: number; name: string; employee_id: string | null }>;
    recruiters?: Array<{ id: number; name: string; employee_id: string | null }>;
    coordinators?: Array<{ id: number; name: string; employee_id: string | null }>;
    sourcers?: Array<{ id: number; name: string; employee_id: string | null }>;
  };
  openings: Array<{
    id: number;
    opening_id: string;
    status: string;
    opened_at: string | null;
    closed_at: string | null;
  }>;
}

interface GreenhouseCandidate {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string;
  is_private: boolean;
  can_email: boolean;
  tags: string[];
  phones?: Array<{ value: string; type: string }>;
  phone_numbers?: Array<{ value: string; type: string }>;
  emails?: Array<{ value: string; type: string }>;
  email_addresses?: Array<{ value: string; type: string }>;
  addresses: Array<{
    value: string;
    type: string;
    street_address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zip: string | null;
  }>;
  website_addresses: Array<{ value: string; type: string }>;
  social_media_addresses: Array<{ value: string; type: string }>;
  recruiter: { id: number; name: string; email: string } | null;
  coordinator: { id: number; name: string; email: string } | null;
  applications: number[];
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    created_at: string;
  }>;
  custom_fields: Record<string, any>;
  keyed_custom_fields: Record<string, any>;
}

interface GreenhouseApplicationAnswer {
  // Greenhouse returns question as string (the question text), not an object
  question: string | { id: number; name: string };
  answer: string | null;
}

interface GreenhouseApplication {
  id: number;
  candidate_id: number;
  prospect: boolean;
  applied_at: string;
  rejected_at: string | null;
  last_activity_at: string;
  source: {
    id: number;
    public_name: string;
  } | null;
  credited_to: { id: number; name: string; email: string } | null;
  rejection_reason: { id: number; name: string; type: { id: number; name: string } } | null;
  rejection_details: string | null;
  current_stage: {
    id: number;
    name: string;
  } | null;
  jobs: Array<{
    id: number;
    name: string;
  }>;
  status: 'active' | 'rejected' | 'hired' | 'withdrawn';
  custom_fields: Record<string, any>;
  keyed_custom_fields: Record<string, any>;
  answers?: GreenhouseApplicationAnswer[]; // Included when fetching with answers
}

interface GreenhouseStage {
  id: number;
  name: string;
  job_id: number;
  stage_type: string;
  priority: number;
  interview_kit: { id: number; name: string } | null;
}

interface GreenhouseInterview {
  id: number;
  application_id: number;
  interview_type: string;
  start: { date_time: string; date: string } | null;
  end: { date_time: string; date: string } | null;
  location: string | null;
  video_conferencing_url: string | null;
  status: string;
  interviewers: Array<{ id: number; name: string; email: string }>;
  created_at: string;
  updated_at: string;
}

interface GreenhouseUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  disabled: boolean;
}

interface GreenhouseScorecard {
  id: number;
  application_id: number;
  interview_id: number | null;
  submitted_at: string;
  overall_recommendation: string;
  questions: Array<{
    id: number;
    question: string;
    answer: string | null;
    type: string;
  }>;
  submitted_by: { id: number; name: string; email: string };
}

interface GreenhouseNote {
  id: number;
  application_id: number;
  user: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  body: string;
  visibility: string;
}

class GreenhouseAPI {
  private apiKey: string;
  private subdomain: string;
  private baseUrl: string;
  private rateLimitDelay: number = 200; // ms between requests to respect rate limits (500 requests per 10 seconds = ~20ms per request, using 200ms for safety)

  constructor(apiKey?: string, subdomain?: string) {
    this.apiKey = apiKey || process.env.GREENHOUSE_API_KEY || '';
    this.subdomain = subdomain || process.env.GREENHOUSE_SUBDOMAIN || '';
    
    if (!this.apiKey) {
      throw new Error('GREENHOUSE_API_KEY environment variable is required');
    }
    // Note: Subdomain is not required for Harvest API (it's centralized)
    // But we keep it for potential future use or other Greenhouse APIs

    this.baseUrl = `https://harvest.greenhouse.io/v1`;
  }

  private async request<T>(endpoint: string, params?: Record<string, any>): Promise<T[]> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const allResults: T[] = [];
    let page = 1;
    let perPage = 100;
    let hasMore = true;

    // Get a user ID for on-behalf-of header (required for many endpoints)
    let userId: number | undefined;
    if (endpoint !== '/users') {
      try {
        // Try to get users first to use for on-behalf-of header
        const usersResponse = await fetch(`${this.baseUrl}/users?per_page=1`, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          },
        });
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          userId = users[0]?.id;
        }
      } catch (e) {
        // If we can't get users, continue without on-behalf-of
      }
    }

    while (hasMore) {
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(perPage));

      // Log progress for large datasets
      if (page % 10 === 1 && page > 1) {
        console.log(`  Fetching ${endpoint} page ${page}... (${allResults.length} items so far)`);
      }

      try {
        const headers: Record<string, string> = {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        };
        
        // Add on-behalf-of header if we have a user ID (required for many endpoints)
        if (userId) {
          headers['On-Behalf-Of'] = String(userId);
        }

        const response = await fetch(url.toString(), {
          headers,
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait longer and retry
            const retryAfter = response.headers.get('retry-after') || '60';
            const waitTime = parseInt(retryAfter) * 1000;
            console.log(`Rate limited, waiting ${waitTime / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          if (response.status === 404) {
            // Endpoint doesn't exist - return empty array
            console.log(`Endpoint ${endpoint} not found (404), skipping...`);
            return [];
          }
          // Try to get error details
          let errorMessage = `${response.status} ${response.statusText}`;
          try {
            const errorData = await response.text();
            if (errorData) {
              errorMessage += `: ${errorData}`;
            }
          } catch (e) {
            // Ignore if we can't parse error
          }
          throw new Error(`Greenhouse API error: ${errorMessage}`);
        }

        const data: T[] = await response.json();
        allResults.push(...data);

        // Check if there are more pages
        const linkHeader = response.headers.get('link');
        hasMore = linkHeader?.includes('rel="next"') ?? false;
        
        if (data.length < perPage) {
          hasMore = false;
        }

        page++;
        
        // Rate limiting - wait between requests (always wait, not just if hasMore)
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      } catch (error) {
        console.error(`Error fetching ${endpoint} page ${page}:`, error);
        throw error;
      }
    }

    return allResults;
  }

  // For single-item endpoints like /candidates/{id}
  private async requestSingle<T>(endpoint: string): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Get a user ID for on-behalf-of header
    let userId: number | undefined;
    try {
      const usersResponse = await fetch(`${this.baseUrl}/users?per_page=1`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
      });
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        userId = users[0]?.id;
      }
    } catch (e) {
      // Continue without on-behalf-of
    }

    const headers: Record<string, string> = {
      'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
    };
    if (userId) {
      headers['On-Behalf-Of'] = String(userId);
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Greenhouse API error: ${response.status} ${response.statusText}`);
    }

    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    return response.json();
  }

  async getAllJobs(options?: { updatedAfter?: Date }): Promise<GreenhouseJob[]> {
    const params: Record<string, any> = {};
    if (options?.updatedAfter) {
      params.updated_after = options.updatedAfter.toISOString();
      console.log(`Fetching jobs updated after ${options.updatedAfter.toISOString()}...`);
    } else {
      console.log('Fetching all jobs from Greenhouse...');
    }
    return this.request<GreenhouseJob>('/jobs', params);
  }

  async getJob(jobId: number): Promise<GreenhouseJob> {
    const jobs = await this.request<GreenhouseJob>(`/jobs/${jobId}`);
    return jobs[0];
  }

  async getJobStages(jobId: number): Promise<GreenhouseStage[]> {
    return this.request<GreenhouseStage>(`/jobs/${jobId}/stages`);
  }

  async getAllCandidates(options?: { updatedAfter?: Date; createdAfter?: Date }): Promise<GreenhouseCandidate[]> {
    const params: Record<string, any> = {};
    if (options?.updatedAfter) {
      params.updated_after = options.updatedAfter.toISOString();
      console.log(`Fetching candidates updated after ${options.updatedAfter.toISOString()}...`);
    } else if (options?.createdAfter) {
      params.created_after = options.createdAfter.toISOString();
      console.log(`Fetching candidates created after ${options.createdAfter.toISOString()}...`);
    } else {
      console.log('Fetching all candidates from Greenhouse...');
    }
    return this.request<GreenhouseCandidate>('/candidates', params);
  }

  async getCandidate(candidateId: number): Promise<GreenhouseCandidate | null> {
    return this.requestSingle<GreenhouseCandidate>(`/candidates/${candidateId}`);
  }

  async getCandidateApplications(candidateId: number): Promise<GreenhouseApplication[]> {
    return this.request<GreenhouseApplication>(`/candidates/${candidateId}/applications`);
  }

  async getAllApplications(options?: { updatedAfter?: Date; createdAfter?: Date; includeAnswers?: boolean }): Promise<GreenhouseApplication[]> {
    const params: Record<string, any> = {};
    if (options?.updatedAfter) {
      params.updated_after = options.updatedAfter.toISOString();
      console.log(`Fetching applications updated after ${options.updatedAfter.toISOString()}...`);
    } else if (options?.createdAfter) {
      params.created_after = options.createdAfter.toISOString();
      console.log(`Fetching applications created after ${options.createdAfter.toISOString()}...`);
    } else {
      console.log('Fetching all applications from Greenhouse...');
    }
    // Include answers when requested - this adds the answers array to each application
    if (options?.includeAnswers) {
      params.include = 'answers';
      console.log('   Including application question answers...');
    }
    return this.request<GreenhouseApplication>('/applications', params);
  }

  async getApplication(applicationId: number): Promise<GreenhouseApplication> {
    const applications = await this.request<GreenhouseApplication>(`/applications/${applicationId}`);
    return applications[0];
  }

  async getApplicationInterviews(applicationId: number): Promise<GreenhouseInterview[]> {
    return this.request<GreenhouseInterview>(`/applications/${applicationId}/interviews`);
  }

  async getApplicationScorecards(applicationId: number): Promise<GreenhouseScorecard[]> {
    return this.request<GreenhouseScorecard>(`/applications/${applicationId}/scorecards`);
  }

  async getApplicationNotes(applicationId: number): Promise<GreenhouseNote[]> {
    return this.request<GreenhouseNote>(`/applications/${applicationId}/notes`);
  }

  async getAllUsers(): Promise<GreenhouseUser[]> {
    console.log('Fetching all users from Greenhouse...');
    return this.request<GreenhouseUser>('/users');
  }

  async getJobPostings(jobId: number): Promise<any[]> {
    return this.request(`/jobs/${jobId}/job_posts`);
  }

  async getSources(): Promise<any[]> {
    return this.request('/sources');
  }

  async getRejectionReasons(): Promise<any[]> {
    return this.request('/rejection_reasons');
  }

  async getOffers(applicationId: number): Promise<any[]> {
    return this.request(`/applications/${applicationId}/offers`);
  }

  // Additional endpoints for all available data points
  async getActivityFeed(applicationId: number): Promise<any[]> {
    return this.request(`/applications/${applicationId}/activity_feed`);
  }

  async getApprovals(applicationId: number): Promise<any[]> {
    return this.request(`/applications/${applicationId}/approvals`);
  }

  async getCloseReasons(): Promise<any[]> {
    return this.request('/close_reasons');
  }

  async getCustomFieldOptions(): Promise<any[]> {
    return this.request('/custom_field_options');
  }

  async getCustomFields(): Promise<any[]> {
    return this.request('/custom_fields');
  }

  async getCustomLocations(): Promise<any[]> {
    return this.request('/custom_locations');
  }

  async getDepartments(): Promise<any[]> {
    return this.request('/departments');
  }

  async getOffices(): Promise<any[]> {
    return this.request('/offices');
  }

  async getEducation(candidateId: number): Promise<any[]> {
    return this.request(`/candidates/${candidateId}/education`);
  }

  async getEEOC(applicationId: number): Promise<any> {
    return this.request(`/applications/${applicationId}/eeoc`).then(data => data[0] || null);
  }

  async getEmailTemplates(): Promise<any[]> {
    return this.request('/email_templates');
  }

  async getJobOpenings(jobId: number): Promise<any[]> {
    return this.request(`/jobs/${jobId}/openings`);
  }

  async getProspectPool(): Promise<any[]> {
    return this.request('/prospect_pool');
  }

  async getTags(): Promise<any[]> {
    return this.request('/tags');
  }

  async getTrackingLinks(): Promise<any[]> {
    return this.request('/tracking_links');
  }

  async getUserRoles(): Promise<any[]> {
    return this.request('/user_roles');
  }

  // Education reference data (degrees, disciplines, schools)
  async getDegrees(): Promise<any[]> {
    return this.request('/degrees');
  }

  async getDisciplines(): Promise<any[]> {
    return this.request('/disciplines');
  }

  async getSchools(): Promise<any[]> {
    return this.request('/schools');
  }

  // Candidate employment history
  async getEmployment(candidateId: number): Promise<any[]> {
    return this.request(`/candidates/${candidateId}/employment`);
  }

  // Get all interviews (not just per application)
  async getAllInterviews(): Promise<any[]> {
    return this.request('/scheduled_interviews');
  }

  // Get all scorecards (not just per application)
  async getAllScorecards(): Promise<any[]> {
    return this.request('/scorecards');
  }

  // Get all offers (not just per application)
  async getAllOffers(): Promise<any[]> {
    return this.request('/offers');
  }

  // Get all EEOC data
  async getAllEEOC(): Promise<any[]> {
    return this.request('/eeoc');
  }

  // Get candidate attachments
  async getCandidateAttachments(candidateId: number): Promise<any[]> {
    return this.request(`/candidates/${candidateId}/attachments`);
  }

  // Get application attachments
  async getApplicationAttachments(applicationId: number): Promise<any[]> {
    return this.request(`/applications/${applicationId}/attachments`);
  }
}

export async function fetchGreenhouseData() {
  const api = new GreenhouseAPI();
  
  console.log('Starting Greenhouse data extraction...');
  console.log('Extracting ALL available data points from Greenhouse...');
  console.log('This may take several minutes depending on data volume...\n');

  const results = {
    // Core entities
    jobs: [] as GreenhouseJob[],
    candidates: [] as GreenhouseCandidate[],
    applications: [] as GreenhouseApplication[],
    users: [] as GreenhouseUser[],
    
    // Reference data
    sources: [] as any[],
    rejectionReasons: [] as any[],
    closeReasons: [] as any[],
    departments: [] as any[],
    offices: [] as any[],
    tags: [] as any[],
    customFields: [] as any[],
    customFieldOptions: [] as any[],
    customLocations: [] as any[],
    emailTemplates: [] as any[],
    trackingLinks: [] as any[],
    userRoles: [] as any[],
    
    // Education reference data
    degrees: [] as any[],
    disciplines: [] as any[],
    schools: [] as any[],
    
    // Additional data
    prospectPool: [] as any[],
    
    // Global collections
    allInterviews: [] as any[],
    allScorecards: [] as any[],
    allOffers: [] as any[],
    allEEOC: [] as any[],
    
    // Detailed data (populated later)
    jobDetails: [] as any[],
    applicationDetails: [] as any[],
    candidateDetails: [] as any[], // education, employment, attachments
  };

  try {
    // Fetch core data first (sequential to avoid rate limits)
    console.log('Fetching core data (jobs, candidates, applications, users)...');
    const jobs = await api.getAllJobs();
    const candidates = await api.getAllCandidates();
    const applications = await api.getAllApplications();
    const users = await api.getAllUsers();
    
    // Fetch reference data in smaller batches
    console.log('Fetching reference data batch 1 (sources, reasons)...');
    const [sources, rejectionReasons, closeReasons] = await Promise.all([
      api.getSources(),
      api.getRejectionReasons(),
      api.getCloseReasons().catch(() => []),
    ]);
    
    console.log('Fetching reference data batch 2 (departments, offices, tags)...');
    const [departments, offices, tags] = await Promise.all([
      api.getDepartments().catch(() => []),
      api.getOffices().catch(() => []),
      api.getTags().catch(() => []),
    ]);
    
    console.log('Fetching reference data batch 3 (custom fields, locations, templates)...');
    const [customFields, customFieldOptions, customLocations, emailTemplates] = await Promise.all([
      api.getCustomFields().catch(() => []),
      api.getCustomFieldOptions().catch(() => []),
      api.getCustomLocations().catch(() => []),
      api.getEmailTemplates().catch(() => []),
    ]);
    
    console.log('Fetching reference data batch 4 (tracking links, roles, prospects, education)...');
    const [trackingLinks, userRoles, prospectPool, degrees, disciplines, schools] = await Promise.all([
      api.getTrackingLinks().catch(() => []),
      api.getUserRoles().catch(() => []),
      api.getProspectPool().catch(() => []),
      api.getDegrees().catch(() => []),
      api.getDisciplines().catch(() => []),
      api.getSchools().catch(() => []),
    ]);
    
    console.log('Fetching global collections (interviews, scorecards, offers, EEOC)...');
    const [allInterviews, allScorecards, allOffers, allEEOC] = await Promise.all([
      api.getAllInterviews().catch(() => []),
      api.getAllScorecards().catch(() => []),
      api.getAllOffers().catch(() => []),
      api.getAllEEOC().catch(() => []),
    ]);

    results.jobs = jobs;
    results.candidates = candidates;
    results.applications = applications;
    results.users = users;
    results.sources = sources;
    results.rejectionReasons = rejectionReasons;
    results.closeReasons = closeReasons;
    results.departments = departments;
    results.offices = offices;
    results.tags = tags;
    results.customFields = customFields;
    results.customFieldOptions = customFieldOptions;
    results.customLocations = customLocations;
    results.emailTemplates = emailTemplates;
    results.trackingLinks = trackingLinks;
    results.userRoles = userRoles;
    results.prospectPool = prospectPool;
    results.degrees = degrees;
    results.disciplines = disciplines;
    results.schools = schools;
    results.allInterviews = allInterviews;
    results.allScorecards = allScorecards;
    results.allOffers = allOffers;
    results.allEEOC = allEEOC;

    console.log(`\n✅ Core Data:`);
    console.log(`   - ${jobs.length} jobs`);
    console.log(`   - ${candidates.length} candidates`);
    console.log(`   - ${applications.length} applications`);
    console.log(`   - ${users.length} users`);
    console.log(`\n✅ Reference Data:`);
    console.log(`   - ${sources.length} sources`);
    console.log(`   - ${rejectionReasons.length} rejection reasons`);
    console.log(`   - ${closeReasons.length} close reasons`);
    console.log(`   - ${departments.length} departments`);
    console.log(`   - ${offices.length} offices`);
    console.log(`   - ${tags.length} tags`);
    console.log(`   - ${customFields.length} custom fields`);
    console.log(`   - ${customFieldOptions.length} custom field options`);
    console.log(`   - ${customLocations.length} custom locations`);
    console.log(`   - ${emailTemplates.length} email templates`);
    console.log(`   - ${trackingLinks.length} tracking links`);
    console.log(`   - ${userRoles.length} user roles`);
    console.log(`   - ${prospectPool.length} prospects`);
    console.log(`   - ${degrees.length} degrees`);
    console.log(`   - ${disciplines.length} disciplines`);
    console.log(`   - ${schools.length} schools`);
    console.log(`   - ${allInterviews.length} total interviews`);
    console.log(`   - ${allScorecards.length} total scorecards`);
    console.log(`   - ${allOffers.length} total offers`);
    console.log(`   - ${allEEOC.length} total EEOC records`);

    // Fetch detailed data for each job (stages, postings, openings) - sequential to avoid rate limits
    console.log('\n📦 Fetching job details (stages, postings, openings)...');
    const jobDetails = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const [stages, postings, openings] = await Promise.all([
          api.getJobStages(job.id).catch(() => []),
          api.getJobPostings(job.id).catch(() => []),
          api.getJobOpenings(job.id).catch(() => []),
        ]);
        jobDetails.push({ jobId: job.id, stages, postings, openings });
        if ((i + 1) % 10 === 0) {
          console.log(`  Processed ${i + 1}/${jobs.length} jobs...`);
        }
      } catch (error) {
        console.error(`Error fetching details for job ${job.id}:`, error);
        jobDetails.push({ jobId: job.id, stages: [], postings: [], openings: [] });
      }
    }
    results.jobDetails = jobDetails;

    // Fetch detailed data for each application - sequential batches to avoid rate limits
    console.log('\n📋 Fetching application details (interviews, scorecards, notes, offers, approvals, activity, EEOC)...');
    const applicationDetails = [];
    const batchSize = 5; // Process 5 applications at a time
    
    for (let i = 0; i < applications.length; i += batchSize) {
      const batch = applications.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (app) => {
          try {
            const [
              interviews,
              scorecards,
              notes,
              offers,
              approvals,
              activityFeed,
              eeoc,
              attachments,
            ] = await Promise.all([
              api.getApplicationInterviews(app.id).catch(() => []),
              api.getApplicationScorecards(app.id).catch(() => []),
              api.getApplicationNotes(app.id).catch(() => []),
              api.getOffers(app.id).catch(() => []),
              api.getApprovals(app.id).catch(() => []),
              api.getActivityFeed(app.id).catch(() => []),
              api.getEEOC(app.id).catch(() => null),
              api.getApplicationAttachments(app.id).catch(() => []),
            ]);
            return {
              applicationId: app.id,
              interviews,
              scorecards,
              notes,
              offers,
              approvals,
              activityFeed,
              eeoc,
              attachments,
            };
          } catch (error) {
            console.error(`Error fetching details for application ${app.id}:`, error);
            return {
              applicationId: app.id,
              interviews: [],
              scorecards: [],
              notes: [],
              offers: [],
              approvals: [],
              activityFeed: [],
              eeoc: null,
              attachments: [],
            };
          }
        })
      );
      applicationDetails.push(...batchResults);
      
      if ((i + batchSize) % 50 === 0 || i + batchSize >= applications.length) {
        console.log(`  Processed ${Math.min(i + batchSize, applications.length)}/${applications.length} applications...`);
      }
      
      // Small delay between batches
      if (i + batchSize < applications.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    results.applicationDetails = applicationDetails;

    // Fetch detailed candidate data (education, employment, attachments) - limit to first 100 to avoid timeout
    console.log('\n👤 Fetching detailed candidate data (education, employment, attachments)...');
    const candidateDetails = [];
    const candidatesToProcess = candidates.slice(0, 100); // Limit to avoid too many requests
    
    for (let i = 0; i < candidatesToProcess.length; i += 5) {
      const batch = candidatesToProcess.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (candidate) => {
          try {
            const [education, employment, attachments] = await Promise.all([
              api.getEducation(candidate.id).catch(() => []),
              api.getEmployment(candidate.id).catch(() => []),
              api.getCandidateAttachments(candidate.id).catch(() => []),
            ]);
            return {
              candidateId: candidate.id,
              education,
              employment,
              attachments,
            };
          } catch (error) {
            return {
              candidateId: candidate.id,
              education: [],
              employment: [],
              attachments: [],
            };
          }
        })
      );
      candidateDetails.push(...batchResults);
      
      if ((i + 5) % 25 === 0 || i + 5 >= candidatesToProcess.length) {
        console.log(`  Processed ${Math.min(i + 5, candidatesToProcess.length)}/${candidatesToProcess.length} candidates...`);
      }
      
      // Small delay between batches
      if (i + 5 < candidatesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    results.candidateDetails = candidateDetails;

    console.log('\n' + '='.repeat(60));
    console.log('✅ Complete data extraction finished!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Jobs: ${results.jobs.length}`);
    console.log(`   Candidates: ${results.candidates.length}`);
    console.log(`   Applications: ${results.applications.length}`);
    console.log(`   Users: ${results.users.length}`);
    console.log(`   Job Details: ${results.jobDetails.length}`);
    console.log(`   Application Details: ${results.applicationDetails.length}`);
    console.log(`   Candidate Details: ${results.candidateDetails.length}`);
    console.log(`   Global Interviews: ${results.allInterviews.length}`);
    console.log(`   Global Scorecards: ${results.allScorecards.length}`);
    console.log(`   Global Offers: ${results.allOffers.length}`);
    console.log(`   Global EEOC: ${results.allEEOC.length}`);

    return results;
  } catch (error) {
    console.error('Error fetching Greenhouse data:', error);
    throw error;
  }
}

export { GreenhouseAPI };
export type {
  GreenhouseJob,
  GreenhouseCandidate,
  GreenhouseApplication,
  GreenhouseApplicationAnswer,
  GreenhouseStage,
  GreenhouseInterview,
  GreenhouseUser,
  GreenhouseScorecard,
  GreenhouseNote,
};
