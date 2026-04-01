'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';
import WebflowNavbar from '@/components/public/WebflowNavbar';
import WebflowFooter from '@/components/public/WebflowFooter';

interface JobQuestion {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'BOOLEAN' | 'URL';
  options: string[];
  required: boolean;
  helpText: string | null;
}

interface Job {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  market: {
    id: string;
    name: string;
    slug: string;
  };
  questions: JobQuestion[];
}

// Format phone number as (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Limit to 10 digits
  const limited = digits.slice(0, 10);

  // Format based on length
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parsedFromResume, setParsedFromResume] = useState(false);

  // Fetch job details
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/public/jobs/${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This job posting is no longer available.');
          } else {
            setError('Failed to load job details.');
          }
          return;
        }
        const data = await res.json();
        setJob(data.job);
      } catch {
        setError('Failed to load job details.');
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [jobId]);

  // Handle resume upload
  const handleResumeChange = useCallback(async (file: File) => {
    // Validate file size (10MB max)
    const MAX_RESUME_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_RESUME_SIZE) {
      setError('Resume must be under 10MB. Please upload a smaller file.');
      return;
    }

    setResumeFile(file);
    setUploadProgress(0);
    setParsedFromResume(false);

    try {
      // Get presigned URL
      const uploadRes = await fetch('/api/upload/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!uploadRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, fileUrl } = await uploadRes.json();

      // Upload to S3
      const uploadToS3 = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadToS3.ok) throw new Error('Failed to upload resume');

      setResumeUrl(fileUrl);
      setUploadProgress(100);

      // Parse resume to extract contact info
      setParsingResume(true);
      try {
        const parseRes = await fetch('/api/parse/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s3Key: fileUrl }),
        });

        if (parseRes.ok) {
          const { data } = await parseRes.json();
          // Auto-fill form fields (only if empty)
          if (data.firstName && !firstName) setFirstName(data.firstName);
          if (data.lastName && !lastName) setLastName(data.lastName);
          if (data.email && !email) setEmail(data.email);
          if (data.phone && !phone) setPhone(formatPhoneNumber(data.phone));
          if (data.linkedinUrl && !linkedinUrl) setLinkedinUrl(data.linkedinUrl);
          setParsedFromResume(true);
        }
      } catch (parseErr) {
        console.error('Resume parsing error:', parseErr);
        // Don't fail the upload if parsing fails
      } finally {
        setParsingResume(false);
      }
    } catch {
      setError('Failed to upload resume. Please try again.');
      setResumeFile(null);
      setUploadProgress(null);
    }
  }, [firstName, lastName, email, phone, linkedinUrl]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Honeypot check — if filled, it's a bot
    const honeypotField = (e.target as HTMLFormElement).elements.namedItem('website_url') as HTMLInputElement;
    if (honeypotField?.value) {
      // Silently reject — bots don't need error messages
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    // Validate required fields
    if (!firstName || !lastName || !email) {
      setError('Please fill in all required fields.');
      setSubmitting(false);
      return;
    }

    // Validate required questions
    if (job?.questions) {
      for (const q of job.questions) {
        if (q.required && !answers[q.id]) {
          setError(`Please answer: "${q.label}"`);
          setSubmitting(false);
          return;
        }
      }
    }

    try {
      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('email', email);
      formData.append('marketId', job?.market.id || '');
      if (phone) formData.append('phone', phone);
      if (linkedinUrl) formData.append('linkedinUrl', linkedinUrl);
      if (resumeUrl) formData.append('resumeUrl', resumeUrl);
      if (Object.keys(answers).length > 0) {
        formData.append('answers', JSON.stringify(answers));
      }

      const res = await fetch('/api/public/applications', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      // Save the portal URL from the response
      if (data.portalUrl) {
        setPortalUrl(data.portalUrl);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // Update answer
  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Render question field
  const renderQuestion = (question: JobQuestion) => {
    const value = answers[question.id] || '';

    switch (question.type) {
      case 'SELECT':
        return (
          <select
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-yellow-500 focus:ring-0 bg-white text-navy-900"
            required={question.required}
          >
            <option value="">Select...</option>
            {question.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'BOOLEAN':
        return (
          <select
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-yellow-500 focus:ring-0 bg-white text-navy-900"
            required={question.required}
          >
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        );

      case 'TEXTAREA':
        return (
          <textarea
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-yellow-500 focus:ring-0 bg-white text-navy-900 min-h-[120px]"
            required={question.required}
            placeholder="Enter your response..."
          />
        );

      case 'URL':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-yellow-500 focus:ring-0 bg-white text-navy-900"
            required={question.required}
            placeholder="https://"
          />
        );

      default: // TEXT
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-yellow-500 focus:ring-0 bg-white text-navy-900"
            required={question.required}
          />
        );
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy-900 mb-3">Application Submitted!</h1>
          <p className="text-navy-600 mb-4">
            Thank you for applying to <strong>{job?.title}</strong> at Acme Talent.
            We&apos;ll review your application and get back to you soon.
          </p>
          <p className="text-sm text-navy-500 mb-6">
            A confirmation email has been sent to <strong>{email}</strong>.
          </p>
          <div className="space-y-3">
            {portalUrl ? (
              <a
                href={portalUrl}
                className="inline-block w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-full hover:bg-purple-700 transition-colors"
              >
                View Application Status
              </a>
            ) : null}
            <Link
              href="/careers#openings"
              className="inline-block w-full px-6 py-3 bg-yellow-500 text-navy-900 font-semibold rounded-full hover:bg-yellow-600 transition-colors"
            >
              Back to Careers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-navy-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-navy-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !job) {
    return (
      <div className="min-h-screen bg-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy-900 mb-3">Job Not Found</h1>
          <p className="text-navy-600 mb-6">{error}</p>
          <Link
            href="/careers#openings"
            className="inline-block px-6 py-3 bg-yellow-500 text-navy-900 font-semibold rounded-full hover:bg-yellow-600 transition-colors"
          >
            View Open Positions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyan-50 flex flex-col">
      {/* Navbar */}
      <WebflowNavbar />

      {/* Back Link */}
      <div className="bg-[#1C9FDB]">
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <Link href="/careers#openings" className="text-white/80 hover:text-white inline-flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to jobs
          </Link>
        </div>
      </div>

      {/* Job Title Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{job?.title}</h1>
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{job?.location || job?.market.name}</span>
          </div>
        </div>
      </div>

      {/* Job Description Section — sanitized via sanitize-html */}
      {job?.description && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div
              className="text-gray-700 leading-relaxed prose prose-sm max-w-none
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-3
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-2
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mb-2
                [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3
                [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:mb-1
                [&_strong]:font-semibold [&_strong]:text-gray-900
                [&_a]:text-cyan-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
            />
          </div>
        </div>
      )}

      {/* Apply Button anchor */}
      <div className="bg-cyan-50 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <a
            href="#apply-form"
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#FDB913] text-gray-900 font-bold rounded-full hover:bg-[#e5a711] transition-colors shadow-md"
          >
            Apply for this Job
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Form Section */}
      <div id="apply-form" className="max-w-3xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-navy-100 overflow-hidden">
          {/* Form Header */}
          <div className="bg-navy-800 text-white px-6 py-4">
            <h2 className="text-xl font-semibold">Apply for this job</h2>
            <p className="text-navy-300 text-sm mt-1">* indicates a required field</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-danger-50 border-b border-danger-200 px-6 py-3 text-danger-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Honeypot field — hidden from real users, catches bots */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              <label htmlFor="website_url">Website</label>
              <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
            </div>

            {/* Resume Upload - First to enable auto-fill */}
            <div>
              <label className="block text-sm font-semibold text-purple-700 mb-2">
                Resume/CV <span className="text-danger-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  resumeFile ? 'border-success-400 bg-success-50' : 'border-yellow-400 hover:border-yellow-500 bg-yellow-50'
                }`}
                onClick={() => document.getElementById('resume-input')?.click()}
              >
                <input
                  id="resume-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleResumeChange(file);
                  }}
                />
                {resumeFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-navy-900 font-medium">{resumeFile.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResumeFile(null);
                        setResumeUrl('');
                        setUploadProgress(null);
                      }}
                      className="text-danger-500 hover:text-danger-700 text-sm underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-yellow-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-navy-700 font-medium">Click to upload or drag and drop</p>
                    <p className="text-navy-500 text-sm mt-1">PDF, DOC, DOCX (max 10MB)</p>
                  </>
                )}
                {uploadProgress !== null && uploadProgress < 100 && (
                  <div className="mt-3">
                    <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
                {parsingResume && (
                  <div className="mt-3 flex items-center gap-2 text-purple-600">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium">Extracting information from resume...</span>
                  </div>
                )}
                {parsedFromResume && !parsingResume && (
                  <div className="mt-3 flex items-center gap-2 text-success-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">Form auto-filled from resume</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information - Auto-filled from resume */}
            <div className="border-t border-navy-100 pt-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Contact Information
                {parsedFromResume && (
                  <span className="text-sm font-normal text-success-600 ml-2">
                    ✓ Auto-filled from resume
                  </span>
                )}
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-purple-700 mb-2">
                      First Name <span className="text-danger-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-purple-700 mb-2">
                      Last Name <span className="text-danger-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-purple-700 mb-2">
                    Email <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-purple-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                    placeholder="(555) 555-5555"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-purple-700 mb-2">
                    LinkedIn Profile
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>
            </div>

            {/* Custom Questions */}
            {job?.questions && job.questions.length > 0 && (
              <div className="border-t border-navy-100 pt-6 space-y-6">
                <h3 className="text-lg font-semibold text-navy-900">Additional Questions</h3>
                {job.questions.map((question) => (
                  <div key={question.id}>
                    <label className="block text-sm font-semibold text-purple-700 mb-2">
                      {question.label} {question.required && <span className="text-danger-500">*</span>}
                    </label>
                    {question.helpText && (
                      <p className="text-sm text-navy-500 mb-2">{question.helpText}</p>
                    )}
                    {renderQuestion(question)}
                  </div>
                ))}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || uploadProgress === 0}
                className="w-full py-4 px-6 bg-yellow-500 text-navy-900 font-bold text-lg rounded-full hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>

            {/* Privacy Notice */}
            <p className="text-xs text-navy-500 text-center">
              By submitting this application, you agree to our{' '}
              <a href="https://acmetalent.com/privacy" className="text-purple-600 hover:underline">
                Privacy Policy
              </a>.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto">
        <WebflowFooter />
      </div>
    </div>
  );
}
