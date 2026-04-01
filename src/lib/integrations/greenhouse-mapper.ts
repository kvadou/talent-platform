/**
 * Greenhouse to ATS Data Mapper
 * 
 * Maps Greenhouse API data structures to ATS database models
 */

import type {
  GreenhouseJob,
  GreenhouseCandidate,
  GreenhouseApplication,
  GreenhouseStage,
  GreenhouseInterview,
  GreenhouseUser,
} from './greenhouse';

export interface MappedJob {
  greenhouseJobId: string;
  title: string;
  description: string | null;
  location: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  metadata: {
    requisitionId: string | null;
    confidential: boolean;
    openedAt: string | null;
    closedAt: string | null;
    departments: Array<{ id: number; name: string }>;
    offices: Array<{ id: number; name: string; location: string | null }>;
    customFields: Record<string, any>;
    hiringTeam: any;
  };
}

export interface MappedCandidate {
  greenhouseCandidateId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  resumeUrl: string | null;
  coverLetter: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  timezone: string | null;
  notes: string | null;
  tags: string[];
  metadata: {
    company: string | null;
    title: string | null;
    isPrivate: boolean;
    canEmail: boolean;
    recruiter: any;
    coordinator: any;
    customFields: Record<string, any>;
  };
}

export interface MappedApplication {
  greenhouseApplicationId: string;
  greenhouseJobId: string;
  greenhouseCandidateId: string;
  status: 'ACTIVE' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  source: string | null;
  rejectionReason: string | null;
  metadata: {
    prospect: boolean;
    appliedAt: string;
    rejectedAt: string | null;
    lastActivityAt: string;
    creditedTo: any;
    customFields: Record<string, any>;
  };
}

export interface MappedStage {
  greenhouseStageId: string;
  name: string;
  order: number;
  isDefault: boolean;
  metadata: {
    stageType: string;
    priority: number;
    interviewKit: any;
  };
}

export function mapGreenhouseJob(job: GreenhouseJob): MappedJob {
  // Extract location from offices
  const location = job.offices
    .map(office => office.location?.name || office.name)
    .join(', ') || null;

  // Map status
  let status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' = 'DRAFT';
  if (job.status === 'open') status = 'PUBLISHED';
  if (job.status === 'closed') status = 'CLOSED';

  return {
    greenhouseJobId: String(job.id),
    title: job.name,
    description: job.notes || null,
    location,
    status,
    metadata: {
      requisitionId: job.requisition_id,
      confidential: job.confidential,
      openedAt: job.opened_at,
      closedAt: job.closed_at,
      departments: job.departments,
      offices: (job.offices || []).map((office: any) => ({
        id: office.id,
        name: office.name,
        location: office.location?.name || null,
      })),
      customFields: {
        ...job.custom_fields,
        ...job.keyed_custom_fields,
      },
      hiringTeam: job.hiring_team,
    },
  };
}

export function mapGreenhouseCandidate(candidate: GreenhouseCandidate): MappedCandidate {
  // Extract primary email - Greenhouse API uses 'email_addresses' not 'emails'
  const email = candidate.email_addresses?.[0]?.value || candidate.emails?.[0]?.value || '';
  
  // Extract primary phone - Greenhouse API uses 'phone_numbers' not 'phones'
  const phone = candidate.phone_numbers?.[0]?.value || candidate.phones?.[0]?.value || null;

  // Extract address - Greenhouse API structure
  const address = candidate.addresses?.[0];
  const street = address?.street_address || null;
  const city = address?.city || null;
  const state = address?.state || null;
  const country = address?.country || 'United States';
  const postcode = address?.zip || null;
  
  // Handle case where addresses might be in different format
  const candidateAny = candidate as any;
  if (!address && candidateAny.addresses && candidateAny.addresses.length > 0) {
    const altAddress = candidateAny.addresses[0];
    if (altAddress.street_address || altAddress.city) {
      // Use alternative address format if available
    }
  }

  // Extract LinkedIn and portfolio URLs
  const linkedinUrl = candidate.social_media_addresses?.find(
    addr => addr.type === 'LinkedIn'
  )?.value || null;
  
  const portfolioUrl = candidate.website_addresses?.find(
    addr => addr.type === 'Portfolio' || addr.type === 'Personal'
  )?.value || null;

  // Extract resume URL
  const resumeAttachment = candidate.attachments?.find(
    att => att.type === 'resume' || att.filename.toLowerCase().includes('resume')
  );
  const resumeUrl = resumeAttachment?.url || null;

  // Build notes from custom fields and other data
  const notesParts: string[] = [];
  if (candidate.company) notesParts.push(`Company: ${candidate.company}`);
  if (candidate.title) notesParts.push(`Title: ${candidate.title}`);
  if (candidate.recruiter) notesParts.push(`Recruiter: ${candidate.recruiter.name}`);
  const notes = notesParts.length > 0 ? notesParts.join('\n') : null;

  return {
    greenhouseCandidateId: String(candidate.id),
    email,
    firstName: candidate.first_name,
    lastName: candidate.last_name,
    phone,
    resumeUrl,
    coverLetter: null, // Will be populated from application
    linkedinUrl,
    portfolioUrl,
    street,
    city,
    state,
    country,
    postcode,
    timezone: null, // Not available in Greenhouse API
    notes,
    tags: candidate.tags || [],
    metadata: {
      company: candidate.company,
      title: candidate.title,
      isPrivate: candidate.is_private,
      canEmail: candidate.can_email,
      recruiter: candidate.recruiter,
      coordinator: candidate.coordinator,
      customFields: {
        ...candidate.custom_fields,
        ...candidate.keyed_custom_fields,
      },
    },
  };
}

export function mapGreenhouseApplication(
  application: GreenhouseApplication,
  candidate?: GreenhouseCandidate
): MappedApplication {
  // Map status
  let status: 'ACTIVE' | 'HIRED' | 'REJECTED' | 'WITHDRAWN' = 'ACTIVE';
  if (application.status === 'hired') status = 'HIRED';
  if (application.status === 'rejected') status = 'REJECTED';
  if (application.status === 'withdrawn') status = 'WITHDRAWN';

  // Extract source
  const source = application.source?.public_name || null;

  // Extract rejection reason
  const rejectionReason = application.rejection_reason?.name || null;

  return {
    greenhouseApplicationId: String(application.id),
    greenhouseJobId: String(application.jobs[0]?.id || ''),
    greenhouseCandidateId: String(application.candidate_id),
    status,
    source,
    rejectionReason,
    metadata: {
      prospect: application.prospect,
      appliedAt: application.applied_at,
      rejectedAt: application.rejected_at,
      lastActivityAt: application.last_activity_at,
      creditedTo: application.credited_to,
      customFields: {
        ...application.custom_fields,
        ...application.keyed_custom_fields,
      },
    },
  };
}

export function mapGreenhouseStage(stage: GreenhouseStage, jobId: string): MappedStage {
  return {
    greenhouseStageId: String(stage.id),
    name: stage.name,
    order: stage.priority || 0,
    isDefault: stage.stage_type === 'application' || false,
    metadata: {
      stageType: stage.stage_type,
      priority: stage.priority,
      interviewKit: stage.interview_kit,
    },
  };
}

export function mapGreenhouseInterview(interview: GreenhouseInterview): Partial<any> {
  return {
    greenhouseInterviewId: String(interview.id),
    scheduledAt: interview.start?.date_time ? new Date(interview.start.date_time) : null,
    duration: interview.end && interview.start
      ? Math.round((new Date(interview.end.date_time).getTime() - new Date(interview.start.date_time).getTime()) / 60000)
      : 60, // Default 60 minutes
    type: mapInterviewType(interview.interview_type),
    location: interview.location || interview.video_conferencing_url || null,
    meetingLink: interview.video_conferencing_url || null,
    status: interview.status,
    metadata: {
      interviewers: interview.interviewers,
      customFields: {},
    },
  };
}

function mapInterviewType(greenhouseType: string): 'PHONE_SCREEN' | 'VIDEO_INTERVIEW' | 'TECHNICAL_INTERVIEW' | 'BEHAVIORAL_INTERVIEW' | 'FINAL_INTERVIEW' | 'ONSITE' {
  const typeMap: Record<string, 'PHONE_SCREEN' | 'VIDEO_INTERVIEW' | 'TECHNICAL_INTERVIEW' | 'BEHAVIORAL_INTERVIEW' | 'FINAL_INTERVIEW' | 'ONSITE'> = {
    'phone_screen': 'PHONE_SCREEN',
    'phone': 'PHONE_SCREEN',
    'video': 'VIDEO_INTERVIEW',
    'technical': 'TECHNICAL_INTERVIEW',
    'behavioral': 'BEHAVIORAL_INTERVIEW',
    'final': 'FINAL_INTERVIEW',
    'onsite': 'ONSITE',
    'on_site': 'ONSITE',
  };

  const normalized = greenhouseType.toLowerCase().replace(/[_-]/g, '_');
  return typeMap[normalized] || 'PHONE_SCREEN';
}
