'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { BookOpenIcon, PhoneIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

interface ZoomUser {
  id: string;
  email: string;
  name: string;
  status: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface InterviewKit {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
}

interface InterviewFormProps {
  applicationId: string;
  jobId?: string;
  candidatePhone?: string | null;
  onCreated?: () => void;
}

export function InterviewForm({ applicationId, jobId, candidatePhone, onCreated }: InterviewFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interviewType, setInterviewType] = useState('PHONE_SCREEN');
  const [location, setLocation] = useState(candidatePhone || '');
  const [zoomUsers, setZoomUsers] = useState<ZoomUser[]>([]);
  const [loadingZoomUsers, setLoadingZoomUsers] = useState(false);
  const [interviewKits, setInterviewKits] = useState<InterviewKit[]>([]);
  const [matchingKit, setMatchingKit] = useState<InterviewKit | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);

  const isVideoInterview = ['VIDEO_INTERVIEW', 'VIDEO_INTERVIEW_AUDITION', 'TECHNICAL_INTERVIEW', 'BEHAVIORAL_INTERVIEW', 'FINAL_INTERVIEW'].includes(interviewType);
  const isZoomInterview = isVideoInterview || interviewType === 'PHONE_SCREEN';

  const loadJobDefaults = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const job = await res.json();
        if (job?.defaultRecordingEnabled !== undefined) {
          setRecordingEnabled(job.defaultRecordingEnabled);
        }
      }
    } catch (err) {
      console.error('Failed to load job defaults:', err);
    }
  }, [jobId]);

  // Auto-populate location with candidate phone for phone screens
  useEffect(() => {
    if (interviewType === 'PHONE_SCREEN' && candidatePhone) {
      setLocation(candidatePhone);
    } else if (interviewType !== 'PHONE_SCREEN') {
      // Clear location when switching away from phone screen (unless user modified it)
      setLocation('');
    }
  }, [interviewType, candidatePhone]);

  const loadTeamMembers = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    // Find matching kit for the selected interview type
    const kit = interviewKits.find(k => k.type === interviewType);
    setMatchingKit(kit || null);
  }, [interviewType, interviewKits]);

  const loadInterviewKits = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/interview-kits`);
      if (res.ok) {
        const data = await res.json();
        setInterviewKits(data.interviewKits || []);
      }
    } catch (err) {
      console.error('Failed to load interview kits:', err);
    }
  }, [jobId]);

  const loadZoomUsers = useCallback(async () => {
    setLoadingZoomUsers(true);
    try {
      const res = await fetch('/api/zoom/users');
      if (res.ok) {
        const data = await res.json();
        setZoomUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load Zoom users:', err);
    } finally {
      setLoadingZoomUsers(false);
    }
  }, []);

  useEffect(() => {
    loadTeamMembers();
    if (jobId) {
      loadInterviewKits();
      loadJobDefaults();
    }
  }, [jobId, loadInterviewKits, loadJobDefaults, loadTeamMembers]);

  useEffect(() => {
    if (isVideoInterview) {
      loadZoomUsers();
    }
  }, [isVideoInterview, loadZoomUsers]);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/interviews', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to schedule');
      onCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <DateTimePicker name="scheduledAt" label="When" required />
      <Input
        name="duration"
        type="number"
        label="Duration (minutes)"
        required
        defaultValue={matchingKit?.duration || 30}
      />
      <Select
        name="interviewerId"
        label="Interviewer"
        required
        disabled={loadingTeam}
      >
        <option value="">Select interviewer...</option>
        {teamMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.firstName} {member.lastName}
          </option>
        ))}
      </Select>
      <Select
        name="type"
        label="Type"
        defaultValue="PHONE_SCREEN"
        onChange={(e) => setInterviewType(e.target.value)}
      >
        <option value="PHONE_SCREEN">Phone Screen</option>
        <option value="VIDEO_INTERVIEW">Video Interview</option>
        <option value="VIDEO_INTERVIEW_AUDITION">Video Interview + Audition</option>
        <option value="TECHNICAL_INTERVIEW">Technical Interview</option>
        <option value="BEHAVIORAL_INTERVIEW">Behavioral Interview</option>
        <option value="FINAL_INTERVIEW">Final Interview</option>
        <option value="IN_PERSON">In-Person</option>
        <option value="ONSITE">Onsite</option>
      </Select>

      {/* Interview Kit Indicator */}
      {matchingKit && (
        <div className="flex items-center gap-2 p-2 bg-cyan-50 rounded-lg">
          <BookOpenIcon className="w-4 h-4 text-cyan-600" />
          <span className="text-sm text-cyan-700">
            Using interview kit: <strong>{matchingKit.name}</strong> ({matchingKit.duration} min)
            {matchingKit.includesAudition && ' + Audition'}
          </span>
        </div>
      )}
      {isVideoInterview && (
        <Select
          name="zoomHostEmail"
          label="Zoom Host (optional)"
          disabled={loadingZoomUsers}
        >
          <option value="">Use default account</option>
          {zoomUsers.map((user) => (
            <option key={user.id} value={user.email}>
              {user.name} ({user.email})
            </option>
          ))}
        </Select>
      )}

      {/* Recording Toggle - show for Zoom-enabled interviews */}
      {isZoomInterview && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <VideoCameraIcon className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-700">Record Interview</p>
              <p className="text-xs text-gray-500">Automatically record and transcribe via Zoom</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="recordingEnabled"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
              className="sr-only peer"
              value="true"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-purple/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
          </label>
        </div>
      )}
      {!isVideoInterview && (
        <div>
          <Input
            name="location"
            label={interviewType === 'PHONE_SCREEN' ? 'Phone Number' : 'Location/Link'}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={interviewType === 'PHONE_SCREEN' ? 'Enter phone number...' : 'Enter location or meeting link...'}
          />
          {interviewType === 'PHONE_SCREEN' && location && (
            <div className="flex items-center gap-2 mt-1.5 p-2 bg-success-50 rounded-lg">
              <PhoneIcon className="w-4 h-4 text-success-600" />
              <span className="text-sm text-success-700">
                Will call candidate at <strong>{location}</strong>
              </span>
            </div>
          )}
        </div>
      )}
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Scheduling...' : 'Schedule interview'}
      </Button>
    </form>
  );
}
