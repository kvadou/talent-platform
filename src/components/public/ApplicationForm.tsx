'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';

interface JobQuestion {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'BOOLEAN' | 'URL';
  options: string[];
  required: boolean;
  helpText: string | null;
}

interface ApplicationFormProps {
  jobId: string;
  jobTitle: string;
  marketId: string;
  questions: JobQuestion[];
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

export default function ApplicationForm({ jobId, jobTitle, marketId, questions }: ApplicationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Refs to avoid stale closures in async resume parse callback
  const firstNameRef = useRef(firstName);
  const lastNameRef = useRef(lastName);
  const emailRef = useRef(email);
  const phoneRef = useRef(phone);
  const linkedinUrlRef = useRef(linkedinUrl);
  firstNameRef.current = firstName;
  lastNameRef.current = lastName;
  emailRef.current = email;
  phoneRef.current = phone;
  linkedinUrlRef.current = linkedinUrl;

  const handleResumeChange = useCallback(async (file: File) => {
    const MAX_RESUME_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_RESUME_SIZE) {
      setError('Resume must be under 10MB. Please upload a smaller file.');
      return;
    }

    setResumeFile(file);
    setUploadProgress(0);
    setParsedFromResume(false);

    try {
      const uploadRes = await fetch('/api/upload/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!uploadRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, fileUrl } = await uploadRes.json();

      const uploadToS3 = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadToS3.ok) throw new Error('Failed to upload resume');

      setResumeUrl(fileUrl);
      setUploadProgress(100);

      setParsingResume(true);
      try {
        const parseRes = await fetch('/api/parse/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s3Key: fileUrl }),
        });
        if (parseRes.ok) {
          const { data } = await parseRes.json();
          // Use refs to check CURRENT values, not stale closure values
          if (data.firstName && !firstNameRef.current) setFirstName(data.firstName);
          if (data.lastName && !lastNameRef.current) setLastName(data.lastName);
          if (data.email && !emailRef.current) setEmail(data.email);
          if (data.phone && !phoneRef.current) setPhone(formatPhoneNumber(data.phone));
          if (data.linkedinUrl && !linkedinUrlRef.current) setLinkedinUrl(data.linkedinUrl);
          setParsedFromResume(true);
        }
      } catch (parseErr) {
        console.error('Resume parsing error:', parseErr);
      } finally {
        setParsingResume(false);
      }
    } catch {
      setError('Failed to upload resume. Please try again.');
      setResumeFile(null);
      setUploadProgress(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const honeypotField = (e.target as HTMLFormElement).elements.namedItem('website_url') as HTMLInputElement;
    if (honeypotField?.value) {
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    if (!resumeUrl) {
      setError('Please upload your resume before submitting.');
      setSubmitting(false);
      document.getElementById('apply-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!firstName || !lastName || !email) {
      setError('Please fill in all required fields (First Name, Last Name, Email).');
      setSubmitting(false);
      document.getElementById('apply-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (questions) {
      for (const q of questions) {
        if (q.required && !answers[q.id]) {
          setError(`Please answer the required question: "${q.label}"`);
          setSubmitting(false);
          document.getElementById('apply-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      formData.append('marketId', marketId);
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

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Something went wrong. Please try again.');
      }

      if (!res.ok) throw new Error(data.error || 'Failed to submit application');

      if (data.portalUrl) setPortalUrl(data.portalUrl);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

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
      default:
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

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-3">Application Submitted!</h2>
          <p className="text-navy-600 mb-4">
            Thank you for applying to <strong>{jobTitle}</strong> at Acme Talent.
            We&apos;ll review your application and get back to you soon.
          </p>
          <p className="text-sm text-navy-500 mb-6">
            A confirmation email has been sent to <strong>{email}</strong>.
          </p>
          <div className="space-y-3">
            {portalUrl && (
              <a
                href={portalUrl}
                className="inline-block w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-full hover:bg-purple-700 transition-colors"
              >
                View Application Status
              </a>
            )}
            <Link
              href="/careers"
              className="inline-block w-full px-6 py-3 bg-yellow-500 text-navy-900 font-semibold rounded-full hover:bg-yellow-600 transition-colors"
            >
              Back to Careers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-navy-100 overflow-hidden">
        <div className="bg-navy-800 text-white px-6 py-4">
          <h2 className="text-xl font-semibold">Apply for this job</h2>
          <p className="text-navy-300 text-sm mt-1">* indicates a required field</p>
        </div>

        {error && (
          <div id="apply-error" className="bg-danger-50 border-b border-danger-200 px-6 py-4 text-danger-700 flex items-start gap-3">
            <svg className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Honeypot */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <label htmlFor="website_url">Website</label>
            <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
          </div>

          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-semibold text-purple-700 mb-2">
              Resume/CV <span className="text-danger-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                resumeFile ? 'border-success-400 bg-success-50' : 'border-yellow-400 hover:border-yellow-500 bg-yellow-50'
              }`}
              onClick={() => document.getElementById('resume-input')?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && (file.type === 'application/pdf' || file.name.match(/\.(pdf|doc|docx)$/i))) {
                  handleResumeChange(file);
                } else if (file) {
                  setError('Please upload a PDF, DOC, or DOCX file.');
                }
              }}
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

          {/* Contact Information */}
          <div className="border-t border-navy-100 pt-6">
            <h3 className="text-lg font-semibold text-navy-900 mb-4">
              Contact Information
              {parsedFromResume && (
                <span className="text-sm font-normal text-success-600 ml-2">
                  Auto-filled from resume
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
                <label className="block text-sm font-semibold text-purple-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-navy-200 rounded-lg focus:border-purple-500 focus:ring-0 bg-white text-navy-900"
                  placeholder="(555) 555-5555"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-purple-700 mb-2">LinkedIn Profile</label>
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
          {questions.length > 0 && (
            <div className="border-t border-navy-100 pt-6 space-y-6">
              <h3 className="text-lg font-semibold text-navy-900">Additional Questions</h3>
              {questions.map((question) => (
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

          {/* Submit */}
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

          <p className="text-xs text-navy-500 text-center">
            By submitting this application, you agree to our{' '}
            <a href="https://acmetalent.com/privacy" className="text-purple-600 hover:underline">
              Privacy Policy
            </a>.
          </p>
        </form>
      </div>
    </div>
  );
}
