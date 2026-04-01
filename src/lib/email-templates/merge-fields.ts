// Email template merge fields matching Greenhouse-style placeholders

export const MERGE_FIELD_CATEGORIES = {
  candidate: {
    label: 'Candidate',
    fields: {
      '{{CANDIDATE_FIRST_NAME}}': 'First name',
      '{{CANDIDATE_LAST_NAME}}': 'Last name',
      '{{CANDIDATE_NAME}}': 'Full name',
      '{{CANDIDATE_EMAIL_ADDRESS}}': 'Email address',
      '{{CANDIDATE_PHONE}}': 'Phone number',
      '{{PREFERRED_FIRST_NAME}}': 'Preferred first name',
      '{{PREFERRED_FULL_NAME}}': 'Preferred full name',
    }
  },
  job: {
    label: 'Job',
    fields: {
      '{{JOB_NAME}}': 'Job title',
      '{{JOB_LOCATION}}': 'Job location',
      '{{OFFICE}}': 'Office/Market name',
    }
  },
  application: {
    label: 'Application',
    fields: {
      '{{APPLICATION_ID}}': 'Application ID',
      '{{CANDIDATE_ID}}': 'Candidate ID',
      '{{APPLIED_DATE}}': 'Date applied',
      '{{SOURCE}}': 'Application source',
      '{{STAGE_NAME}}': 'Current stage',
    }
  },
  interview: {
    label: 'Interview',
    fields: {
      '{{INTERVIEW_SCHEDULE}}': 'Interview schedule details',
      '{{INTERVIEW_SCHEDULE_START_TIME}}': 'Interview start time',
      '{{INTERVIEW_DATE}}': 'Interview date',
      '{{INTERVIEW_TIME}}': 'Interview time',
      '{{INTERVIEW_DURATION}}': 'Interview duration',
      '{{INTERVIEW_LOCATION}}': 'Interview location/link',
      '{{INTERVIEWER_NAME}}': 'Interviewer name',
    }
  },
  scheduling: {
    label: 'Scheduling',
    fields: {
      '{{AVAILABILITY_SUBMISSION_LINK}}': 'Self-scheduling link',
      '{{SCHEDULING_LINK}}': 'Scheduling link',
      '{{CALENDAR_LINK}}': 'Add to calendar link',
    }
  },
  company: {
    label: 'Company & Sender',
    fields: {
      '{{COMPANY}}': 'Company name',
      '{{MY_EMAIL_ADDRESS}}': 'Sender email',
      '{{MY_FIRST_NAME}}': 'Sender first name',
      '{{MY_FULL_NAME}}': 'Sender full name',
      '{{MY_JOB_TITLE}}': 'Sender job title',
      '{{MY_SIGNATURE}}': 'Sender email signature',
      '{{RECRUITER}}': 'Recruiter name',
      '{{COORDINATOR}}': 'Coordinator name',
    }
  },
  offer: {
    label: 'Offer',
    fields: {
      '{{SALARY}}': 'Salary amount',
      '{{SALARY_FREQUENCY}}': 'Salary frequency (annual/hourly)',
      '{{HOURLY_RATE}}': 'Hourly rate',
      '{{START_DATE}}': 'Start date',
      '{{EXPIRATION}}': 'Offer expiration date',
      '{{SIGN_ON_BONUS}}': 'Sign-on bonus',
      '{{HIRING_MANAGER}}': 'Hiring manager name',
    }
  },
  general: {
    label: 'General',
    fields: {
      '{{TODAY_DATE}}': 'Today\'s date',
      '{{COMPANY_CAREERS_URL}}': 'Careers page URL',
    }
  }
} as const;

// Flat list of all merge fields for validation
export const ALL_MERGE_FIELDS = Object.values(MERGE_FIELD_CATEGORIES).flatMap(
  category => Object.keys(category.fields)
);

// Template type to relevant merge fields mapping
export const TEMPLATE_TYPE_FIELDS: Record<string, string[]> = {
  APPLICATION_RECEIVED: [
    '{{CANDIDATE_FIRST_NAME}}', '{{CANDIDATE_NAME}}', '{{JOB_NAME}}',
    '{{COMPANY}}', '{{TODAY_DATE}}'
  ],
  APPLICATION_REJECTION: [
    '{{CANDIDATE_FIRST_NAME}}', '{{CANDIDATE_NAME}}', '{{JOB_NAME}}',
    '{{COMPANY}}', '{{APPLIED_DATE}}'
  ],
  AVAILABILITY_REQUEST: [
    '{{CANDIDATE_FIRST_NAME}}', '{{JOB_NAME}}', '{{COMPANY}}',
    '{{AVAILABILITY_SUBMISSION_LINK}}', '{{MY_FULL_NAME}}', '{{MY_SIGNATURE}}'
  ],
  INTERVIEW_CONFIRMATION: [
    '{{CANDIDATE_FIRST_NAME}}', '{{JOB_NAME}}', '{{COMPANY}}',
    '{{INTERVIEW_SCHEDULE}}', '{{INTERVIEW_DATE}}', '{{INTERVIEW_TIME}}',
    '{{INTERVIEW_LOCATION}}', '{{INTERVIEWER_NAME}}', '{{CALENDAR_LINK}}'
  ],
  INTERVIEW_REMINDER: [
    '{{CANDIDATE_FIRST_NAME}}', '{{JOB_NAME}}',
    '{{INTERVIEW_DATE}}', '{{INTERVIEW_TIME}}', '{{INTERVIEW_LOCATION}}'
  ],
  SCHEDULING_LINK: [
    '{{CANDIDATE_FIRST_NAME}}', '{{JOB_NAME}}', '{{COMPANY}}',
    '{{SCHEDULING_LINK}}', '{{MY_FULL_NAME}}'
  ],
  OFFER_EXTENDED: [
    '{{CANDIDATE_FIRST_NAME}}', '{{JOB_NAME}}', '{{COMPANY}}',
    '{{SALARY}}', '{{START_DATE}}', '{{EXPIRATION}}', '{{HIRING_MANAGER}}'
  ],
  SCORECARD_REMINDER: [
    '{{CANDIDATE_NAME}}', '{{JOB_NAME}}', '{{INTERVIEW_DATE}}',
    '{{INTERVIEWER_NAME}}'
  ],
  CUSTOM: ALL_MERGE_FIELDS
};

// Get merge fields relevant to a template type
export function getMergeFieldsForType(type: string): typeof MERGE_FIELD_CATEGORIES {
  const relevantFields = TEMPLATE_TYPE_FIELDS[type] || ALL_MERGE_FIELDS;

  // Filter categories to only include relevant fields
  const filtered: Record<string, { label: string; fields: Record<string, string> }> = {};

  for (const [categoryKey, category] of Object.entries(MERGE_FIELD_CATEGORIES)) {
    const categoryFields: Record<string, string> = {};
    for (const [field, label] of Object.entries(category.fields)) {
      if (relevantFields.includes(field)) {
        categoryFields[field] = label;
      }
    }
    if (Object.keys(categoryFields).length > 0) {
      filtered[categoryKey] = { label: category.label, fields: categoryFields };
    }
  }

  return filtered as typeof MERGE_FIELD_CATEGORIES;
}

// Validate merge fields in template
export function validateMergeFields(template: string): { valid: boolean; fields: string[]; unknown: string[] } {
  const fieldRegex = /\{\{[A-Z_]+\}\}/g;
  const matches = template.match(fieldRegex) || [];
  const fields = [...new Set(matches)];
  const unknown = fields.filter(f => !ALL_MERGE_FIELDS.includes(f));

  return {
    valid: unknown.length === 0,
    fields,
    unknown
  };
}

// Replace merge fields with actual values
export function replaceMergeFields(
  template: string,
  data: Record<string, string | undefined>
): string {
  let result = template;

  for (const [field, value] of Object.entries(data)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(field.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
  }

  return result;
}

// Template type labels for UI
export const TEMPLATE_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  APPLICATION_RECEIVED: {
    label: 'Thank You For Applying',
    description: 'Sent automatically when candidates complete an application'
  },
  APPLICATION_REJECTION: {
    label: 'Candidate Rejection',
    description: 'Sent when a candidate is rejected from consideration'
  },
  AVAILABILITY_REQUEST: {
    label: 'Candidate Availability Request',
    description: 'Request candidate availability for interview scheduling'
  },
  INTERVIEW_CONFIRMATION: {
    label: 'Candidate Interview Confirmation',
    description: 'Confirm interview details with candidates'
  },
  INTERVIEW_REMINDER: {
    label: 'Interview Reminder',
    description: 'Reminder sent before scheduled interviews'
  },
  INTERVIEW_CANCELLATION: {
    label: 'Interview Cancellation',
    description: 'Notify candidates when interviews are cancelled'
  },
  INTERVIEW_RESCHEDULE: {
    label: 'Interview Reschedule',
    description: 'Notify candidates when interviews are rescheduled'
  },
  SCHEDULING_LINK: {
    label: 'Self-Schedule Request',
    description: 'Send scheduling links for candidates to book interviews'
  },
  STAGE_CHANGE: {
    label: 'Stage Change Notification',
    description: 'Notify when candidates move to a new pipeline stage'
  },
  OFFER_EXTENDED: {
    label: 'Extending Offer',
    description: 'Send job offer details to candidates'
  },
  OFFER_ACCEPTED: {
    label: 'Offer Accepted',
    description: 'Confirmation when candidate accepts offer'
  },
  OFFER_DECLINED: {
    label: 'Offer Declined',
    description: 'Response when candidate declines offer'
  },
  SCORECARD_REMINDER: {
    label: 'Scorecard Due',
    description: 'Remind interviewers to complete scorecards'
  },
  INTERVIEWER_INVITE: {
    label: 'Interviewer Invite',
    description: 'Invite team members to participate in interviews'
  },
  REFERRAL_RECEIPT: {
    label: 'Referral Receipt',
    description: 'Acknowledge employee referrals'
  },
  CUSTOM: {
    label: 'Custom Template',
    description: 'Custom email template for any purpose'
  }
};
