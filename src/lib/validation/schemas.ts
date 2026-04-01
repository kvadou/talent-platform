import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  location: z.string().optional(),
  marketId: z.string(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT')
});

export const applicationSchema = z.object({
  jobId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  coverLetter: z.string().optional(),
  marketId: z.string()
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
