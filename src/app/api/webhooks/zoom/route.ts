import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Zoom webhook event types we care about
const RECORDING_COMPLETED = 'recording.completed';
const ENDPOINT_URL_VALIDATION = 'endpoint.url_validation';

// Zoom Phone event types
// Note: Zoom sends 'phone.recording_completed', not 'phone.call_recording_completed'
const PHONE_RECORDING_COMPLETED = 'phone.recording_completed';
const PHONE_TRANSCRIPTION_COMPLETED = 'phone.recording_transcription_completed';

interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      id: string | number; // Meeting ID
      uuid: string;
      host_id: string;
      host_email: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      recording_files?: Array<{
        id: string;
        meeting_id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_extension: string;
        file_size: number;
        play_url: string;
        download_url: string;
        status: string;
        recording_type: string;
      }>;
    };
  };
  download_token?: string;
}

interface ZoomValidationPayload {
  payload: {
    plainToken: string;
  };
}

// Zoom Phone recording webhook payload
interface ZoomPhoneRecordingPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      call_id: string;
      call_log_id: string;
      caller_number: string;        // The number that made the call
      caller_number_type: number;   // 1=internal, 2=external
      callee_number: string;        // The number that was called
      callee_number_type: number;
      direction: 'inbound' | 'outbound';
      date_time: string;            // Call start time
      duration: number;             // Call duration in seconds
      download_url: string;         // Recording download URL
      file_type: string;            // MP3, etc.
      file_size: number;
      recording_type: string;
      owner?: {
        type: string;
        id: string;
        name: string;
        extension_number: string;
      };
    };
  };
  download_token?: string;
}

// Zoom Phone transcription webhook payload
interface ZoomPhoneTranscriptPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      call_id: string;
      call_log_id: string;
      caller_number: string;
      callee_number: string;
      direction: 'inbound' | 'outbound';
      date_time: string;
      duration: number;
      transcript_download_url: string;
      transcript_content?: {
        text: string;
        segments?: Array<{
          speaker: string;
          start_time: number;
          end_time: number;
          text: string;
        }>;
      };
    };
  };
}

/**
 * Verify Zoom webhook signature
 */
function verifyZoomWebhook(body: string, signature: string, timestamp: string): boolean {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken) {
    console.warn('ZOOM_WEBHOOK_SECRET_TOKEN not configured');
    return false;
  }

  const message = `v0:${timestamp}:${body}`;
  const hashForVerify = crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hashForVerify}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle Zoom URL validation challenge
 */
function handleValidation(payload: ZoomValidationPayload): Response {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const plainToken = payload.payload.plainToken;
  const encryptedToken = crypto
    .createHmac('sha256', secretToken)
    .update(plainToken)
    .digest('hex');

  return NextResponse.json({
    plainToken,
    encryptedToken,
  });
}

/**
 * POST /api/webhooks/zoom
 * Handles Zoom webhook events for recording completion
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-zm-signature') || '';
  const timestamp = req.headers.get('x-zm-request-timestamp') || '';

  // Parse the payload
  let payload: ZoomWebhookPayload | ZoomValidationPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle URL validation (required for Zoom webhook setup)
  if ('payload' in payload && 'plainToken' in payload.payload) {
    console.log('Zoom webhook validation request received');
    return handleValidation(payload as ZoomValidationPayload);
  }

  // Verify signature for real events
  if (process.env.NODE_ENV === 'production') {
    if (!verifyZoomWebhook(body, signature, timestamp)) {
      console.error('Invalid Zoom webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const webhookPayload = payload as ZoomWebhookPayload;
  const { event } = webhookPayload;

  console.log(`Zoom webhook received: ${event}`);

  // Handle recording completed event (Zoom Meetings)
  if (event === RECORDING_COMPLETED) {
    try {
      await handleRecordingCompleted(webhookPayload);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Error handling recording completed:', error);
      // Return 200 to prevent Zoom from retrying, but log the error
      return NextResponse.json({ received: true, error: 'Processing failed' });
    }
  }

  // Handle phone recording completed event (Zoom Phone)
  if (event === PHONE_RECORDING_COMPLETED) {
    try {
      await handlePhoneRecordingCompleted(webhookPayload as unknown as ZoomPhoneRecordingPayload);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Error handling phone recording completed:', error);
      return NextResponse.json({ received: true, error: 'Processing failed' });
    }
  }

  // Handle phone transcription completed event (Zoom Phone)
  if (event === PHONE_TRANSCRIPTION_COMPLETED) {
    try {
      await handlePhoneTranscriptCompleted(webhookPayload as unknown as ZoomPhoneTranscriptPayload);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Error handling phone transcription completed:', error);
      return NextResponse.json({ received: true, error: 'Processing failed' });
    }
  }

  // Acknowledge other events
  return NextResponse.json({ received: true });
}

/**
 * Handle recording.completed event
 */
async function handleRecordingCompleted(payload: ZoomWebhookPayload) {
  const { object } = payload.payload;
  const meetingId = String(object.id);
  const recordingFiles = object.recording_files || [];

  console.log(`Processing recording for meeting ${meetingId} with ${recordingFiles.length} files`);

  // Find the interview by Zoom meeting ID
  // The meeting ID might be stored with or without hyphens
  const interview = await prisma.interview.findFirst({
    where: {
      OR: [
        { zoomMeetingId: meetingId },
        { zoomMeetingId: meetingId.replace(/-/g, '') },
        { meetingLink: { contains: meetingId } },
      ],
    },
    include: {
      recording: true,
    },
  });

  if (!interview) {
    console.log(`No interview found for Zoom meeting ${meetingId}`);
    // This might be a meeting not related to interviews, that's okay
    return;
  }

  // Find the video and audio recording files
  const videoFile = recordingFiles.find(
    (f) => f.recording_type === 'shared_screen_with_speaker_view' || f.file_type === 'MP4'
  );
  const audioFile = recordingFiles.find(
    (f) => f.recording_type === 'audio_only' || f.file_type === 'M4A'
  );

  if (!videoFile && !audioFile) {
    console.log(`No video or audio files found for meeting ${meetingId}`);
    return;
  }

  // Calculate total duration from recording files
  const duration = videoFile
    ? Math.round(
        (new Date(videoFile.recording_end).getTime() -
          new Date(videoFile.recording_start).getTime()) /
          1000
      )
    : audioFile
    ? Math.round(
        (new Date(audioFile.recording_end).getTime() -
          new Date(audioFile.recording_start).getTime()) /
          1000
      )
    : null;

  // Create or update the recording record
  const recording = await prisma.interviewRecording.upsert({
    where: { interviewId: interview.id },
    create: {
      interviewId: interview.id,
      zoomMeetingId: meetingId,
      zoomRecordingId: videoFile?.id || audioFile?.id,
      duration,
      fileSize: (videoFile?.file_size || 0) + (audioFile?.file_size || 0),
      status: 'PENDING',
      recordedAt: new Date(object.start_time),
    },
    update: {
      zoomMeetingId: meetingId,
      zoomRecordingId: videoFile?.id || audioFile?.id,
      duration,
      fileSize: (videoFile?.file_size || 0) + (audioFile?.file_size || 0),
      status: 'PENDING',
      recordedAt: new Date(object.start_time),
    },
  });

  console.log(`Created/updated recording ${recording.id} for interview ${interview.id}`);

  // Store the download URLs in metadata for processing
  // We'll process these asynchronously to avoid webhook timeout
  await prisma.interviewRecording.update({
    where: { id: recording.id },
    data: {
      // Store download info temporarily - will be cleared after processing
      // Using a JSON field would be ideal, but we'll use the existing schema
      status: 'DOWNLOADING',
    },
  });

  // Trigger async processing (fire and forget)
  // In production, you'd use a job queue like Inngest, Bull, or AWS SQS
  processRecordingAsync(recording.id, {
    videoUrl: videoFile?.download_url,
    audioUrl: audioFile?.download_url,
    downloadToken: payload.download_token,
  }).catch((error) => {
    console.error(`Failed to process recording ${recording.id}:`, error);
  });
}

/**
 * Process recording asynchronously
 * Downloads from Zoom and uploads to S3
 */
async function processRecordingAsync(
  recordingId: string,
  urls: {
    videoUrl?: string;
    audioUrl?: string;
    downloadToken?: string;
  }
) {
  // Import these dynamically to avoid circular dependencies
  const { downloadZoomRecording } = await import('@/lib/zoom');
  const { uploadInterviewRecording } = await import('@/lib/s3');

  console.log(`Starting async processing for recording ${recordingId}`);

  const recording = await prisma.interviewRecording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    console.error(`Recording ${recordingId} not found`);
    return;
  }

  try {
    let videoS3Url: string | null = null;
    let audioS3Url: string | null = null;
    let totalSize = 0;

    // Download and upload video
    if (urls.videoUrl) {
      console.log(`Downloading video for recording ${recordingId}`);
      const videoBuffer = await downloadZoomRecording(urls.videoUrl);
      const result = await uploadInterviewRecording(
        recording.interviewId,
        videoBuffer,
        'video',
        'mp4'
      );
      videoS3Url = result.url;
      totalSize += result.size;
      console.log(`Uploaded video to S3: ${result.key}`);
    }

    // Download and upload audio
    let audioBuffer: Buffer | null = null;
    if (urls.audioUrl) {
      console.log(`Downloading audio for recording ${recordingId}`);
      audioBuffer = await downloadZoomRecording(urls.audioUrl);
      const result = await uploadInterviewRecording(
        recording.interviewId,
        audioBuffer,
        'audio',
        'm4a'
      );
      audioS3Url = result.url;
      totalSize += result.size;
      console.log(`Uploaded audio to S3: ${result.key}`);
    }

    // Update recording with S3 URLs
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: {
        videoUrl: videoS3Url,
        audioUrl: audioS3Url,
        fileSize: totalSize,
        status: 'TRANSCRIBING',
        processedAt: new Date(),
      },
    });

    console.log(`Recording ${recordingId} uploaded, starting transcription...`);

    // Transcribe audio if available
    if (audioBuffer) {
      try {
        const { transcribeAudio, mergeAdjacentSegments } = await import('@/lib/whisper');

        console.log(`Transcribing audio for recording ${recordingId}`);
        const transcription = await transcribeAudio(audioBuffer, 'interview.m4a');

        // Merge adjacent segments from same speaker for cleaner display
        const mergedSegments = mergeAdjacentSegments(transcription.segments);

        // Store transcript
        await prisma.interviewTranscript.create({
          data: {
            recordingId,
            fullText: transcription.fullText,
            segments: JSON.parse(JSON.stringify(mergedSegments)),
          },
        });

        console.log(`Transcript created for recording ${recordingId}: ${transcription.segments.length} segments`);

        // Trigger AI analysis after transcription
        try {
          console.log(`Starting AI analysis for recording ${recordingId}`);
          await triggerAIAnalysis(recording.interviewId, mergedSegments, transcription.fullText);
          console.log(`AI analysis completed for recording ${recordingId}`);
        } catch (aiError) {
          console.error(`AI analysis failed for recording ${recordingId}:`, aiError);
          // Don't fail if AI analysis fails
        }
      } catch (transcriptError) {
        console.error(`Transcription failed for recording ${recordingId}:`, transcriptError);
        // Don't fail the whole process if transcription fails
      }
    }

    // Mark as ready
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: {
        status: 'READY',
      },
    });

    console.log(`Recording ${recordingId} processed successfully`);

    // Optionally delete Zoom cloud recordings to save storage
    // Uncomment if you want to auto-delete from Zoom after upload to S3
    // if (recording.zoomMeetingId) {
    //   await deleteZoomMeetingRecordings(recording.zoomMeetingId);
    // }
  } catch (error) {
    console.error(`Failed to process recording ${recordingId}:`, error);
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: {
        status: 'FAILED',
      },
    });
    throw error;
  }
}

/**
 * Trigger AI analysis for an interview
 */
async function triggerAIAnalysis(
  interviewId: string,
  segments: any[],
  fullText: string
) {
  const { analyzeInterviewTranscript, generateQuickSummary } =
    await import('@/lib/ai-interview-analysis');
  type ScorecardAttribute = {
    id: string;
    name: string;
    description: string | null;
    categoryName: string;
  };

  // Get interview context
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          candidate: true,
          job: {
            include: {
              interviewKits: {
                include: {
                  categories: {
                    include: {
                      attributes: true,
                    },
                  },
                },
              },
            },
          },
          stage: true,
        },
      },
    },
  });

  if (!interview) {
    console.error(`Interview ${interviewId} not found for AI analysis`);
    return;
  }

  const candidate = interview.application.candidate;
  const job = interview.application.job;

  // Find matching interview kit
  const matchingKit = job.interviewKits.find(
    (kit) =>
      kit.type === interview.type ||
      kit.stageId === interview.application.stageId
  );

  // Build attributes list
  const attributes: ScorecardAttribute[] = matchingKit
    ? matchingKit.categories.flatMap((cat) =>
        cat.attributes.map((attr) => ({
          id: attr.id,
          name: attr.name,
          description: attr.description,
          categoryName: cat.name,
        }))
      )
    : [];

  let analysisResult;

  if (attributes.length > 0) {
    analysisResult = await analyzeInterviewTranscript(
      { fullText, segments },
      {
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        jobTitle: job.title,
        jobDescription: job.description || undefined,
        interviewType: interview.type,
        attributes,
      }
    );
  } else {
    const quickResult = await generateQuickSummary(
      { fullText, segments },
      {
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        jobTitle: job.title,
        interviewType: interview.type,
      }
    );
    analysisResult = {
      ...quickResult,
      attributeAnalysis: [],
      followUpQuestions: [],
    };
  }

  // Store the analysis
  await prisma.interviewAISummary.create({
    data: {
      interviewId,
      summary: analysisResult.summary,
      attributeAnalysis: JSON.parse(JSON.stringify(analysisResult.attributeAnalysis)),
      recommendation: analysisResult.recommendation,
      recommendationScore: analysisResult.recommendationScore,
      recommendationReason: analysisResult.recommendationReason,
      strengths: JSON.parse(JSON.stringify(analysisResult.strengths)),
      concerns: JSON.parse(JSON.stringify(analysisResult.concerns)),
      followUpQuestions: JSON.parse(JSON.stringify(analysisResult.followUpQuestions)),
    },
  });
}

// ============================================
// ZOOM PHONE RECORDING HANDLERS
// ============================================

/**
 * Normalize a phone number for comparison
 * Removes all non-digit characters and handles country codes
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits, remove the leading 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }

  // Return last 10 digits for matching (handles various formats)
  return digits.slice(-10);
}

/**
 * Find an interview by phone number
 * Matches against:
 * 1. Interview location field (for PHONE_SCREEN interviews)
 * 2. Candidate phone number
 *
 * Prioritizes recent interviews (within last 24 hours)
 */
async function findInterviewByPhoneNumber(phoneNumber: string): Promise<{
  interview: { id: string; applicationId: string } | null;
  candidate: { id: string; firstName: string; lastName: string } | null;
  matchType: 'interview_location' | 'candidate_phone' | 'none';
}> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  // Look at interviews scheduled within the past 24 hours OR the next 7 days
  // This handles cases where calls happen early or slightly late
  const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  console.log(`Looking for interview with phone number: ${phoneNumber} (normalized: ${normalizedPhone})`);

  // Strategy 1: Find phone screen interviews by location field (most accurate)
  // The location field stores the phone number for PHONE_SCREEN interviews
  const phoneScreenInterview = await prisma.interview.findFirst({
    where: {
      type: 'PHONE_SCREEN',
      scheduledAt: { gte: past24Hours, lte: next7Days },
      recordingEnabled: true,
      recording: null, // No existing recording
    },
    orderBy: { scheduledAt: 'desc' },
    include: {
      application: {
        include: {
          candidate: true,
        },
      },
    },
  });

  if (phoneScreenInterview?.location) {
    const normalizedLocation = normalizePhoneNumber(phoneScreenInterview.location);
    if (normalizedLocation === normalizedPhone) {
      console.log(`Found interview ${phoneScreenInterview.id} by location match`);
      return {
        interview: { id: phoneScreenInterview.id, applicationId: phoneScreenInterview.applicationId },
        candidate: phoneScreenInterview.application.candidate,
        matchType: 'interview_location',
      };
    }
  }

  // Strategy 2: Find by candidate phone number
  // Look for candidates with matching phone who have recent PHONE_SCREEN interviews
  const candidateWithInterview = await prisma.candidate.findFirst({
    where: {
      phone: { not: null },
      applications: {
        some: {
          interviews: {
            some: {
              type: 'PHONE_SCREEN',
              scheduledAt: { gte: past24Hours, lte: next7Days },
              recordingEnabled: true,
              recording: null,
            },
          },
        },
      },
    },
    include: {
      applications: {
        include: {
          interviews: {
            where: {
              type: 'PHONE_SCREEN',
              scheduledAt: { gte: past24Hours, lte: next7Days },
              recordingEnabled: true,
              recording: null,
            },
            orderBy: { scheduledAt: 'desc' },
            take: 1,
          },
        },
        where: {
          interviews: {
            some: {
              type: 'PHONE_SCREEN',
              scheduledAt: { gte: past24Hours, lte: next7Days },
              recordingEnabled: true,
              recording: null,
            },
          },
        },
      },
    },
  });

  if (candidateWithInterview?.phone) {
    const normalizedCandidatePhone = normalizePhoneNumber(candidateWithInterview.phone);
    if (normalizedCandidatePhone === normalizedPhone) {
      const interview = candidateWithInterview.applications[0]?.interviews[0];
      if (interview) {
        console.log(`Found interview ${interview.id} by candidate phone match`);
        return {
          interview: { id: interview.id, applicationId: interview.applicationId },
          candidate: candidateWithInterview,
          matchType: 'candidate_phone',
        };
      }
    }
  }

  // Strategy 3: Broader search - any recent phone screen that hasn't been recorded
  // This catches cases where the phone number might not exactly match
  const anyRecentPhoneScreen = await prisma.interview.findFirst({
    where: {
      type: 'PHONE_SCREEN',
      scheduledAt: { gte: past24Hours, lte: next7Days },
      recordingEnabled: true,
      recording: null,
    },
    orderBy: { scheduledAt: 'desc' },
    include: {
      application: {
        include: {
          candidate: true,
        },
      },
    },
  });

  if (anyRecentPhoneScreen) {
    console.log(`Found recent phone screen interview ${anyRecentPhoneScreen.id} (no exact phone match)`);
    return {
      interview: { id: anyRecentPhoneScreen.id, applicationId: anyRecentPhoneScreen.applicationId },
      candidate: anyRecentPhoneScreen.application.candidate,
      matchType: 'none', // No exact phone match, but best guess
    };
  }

  console.log('No matching interview found for phone number');
  return { interview: null, candidate: null, matchType: 'none' };
}

/**
 * Handle phone.call_recording_completed event
 */
async function handlePhoneRecordingCompleted(payload: ZoomPhoneRecordingPayload) {
  const { object } = payload.payload;
  const callId = object.call_id;
  const callerNumber = object.caller_number;
  const calleeNumber = object.callee_number;
  const direction = object.direction;
  const duration = object.duration;
  const downloadUrl = object.download_url;
  const fileSize = object.file_size;
  const callDateTime = object.date_time;

  console.log(`Processing phone recording for call ${callId}`);
  console.log(`Direction: ${direction}, Caller: ${callerNumber}, Callee: ${calleeNumber}`);

  // Determine which number is the candidate
  // For outbound calls: callee is the candidate
  // For inbound calls: caller is the candidate
  const candidateNumber = direction === 'outbound' ? calleeNumber : callerNumber;

  // Find the interview by phone number
  const { interview, candidate, matchType } = await findInterviewByPhoneNumber(candidateNumber);

  if (!interview) {
    console.log(`No interview found for phone call ${callId}`);
    console.log(`  Caller: ${callerNumber}, Callee: ${calleeNumber}, Direction: ${direction}`);
    console.log(`  Candidate number searched: ${candidateNumber}`);
    // TODO: Could add UnmatchedPhoneRecording table for manual matching later
    return;
  }

  console.log(`Matched call ${callId} to interview ${interview.id} (match type: ${matchType})`);

  // Create or update the recording record
  const recording = await prisma.interviewRecording.upsert({
    where: { interviewId: interview.id },
    create: {
      interviewId: interview.id,
      zoomMeetingId: callId, // Using call ID as meeting ID
      zoomRecordingId: object.call_log_id,
      duration,
      fileSize,
      status: 'PENDING',
      recordedAt: new Date(callDateTime),
    },
    update: {
      zoomMeetingId: callId,
      zoomRecordingId: object.call_log_id,
      duration,
      fileSize,
      status: 'PENDING',
      recordedAt: new Date(callDateTime),
    },
  });

  console.log(`Created/updated recording ${recording.id} for interview ${interview.id}`);

  // Update status to downloading
  await prisma.interviewRecording.update({
    where: { id: recording.id },
    data: { status: 'DOWNLOADING' },
  });

  // Process recording asynchronously
  processPhoneRecordingAsync(recording.id, {
    audioUrl: downloadUrl,
    downloadToken: payload.download_token,
  }).catch((error) => {
    console.error(`Failed to process phone recording ${recording.id}:`, error);
  });
}

/**
 * Process phone recording asynchronously
 */
async function processPhoneRecordingAsync(
  recordingId: string,
  urls: {
    audioUrl: string;
    downloadToken?: string;
  }
) {
  const { downloadZoomRecording } = await import('@/lib/zoom');
  const { uploadInterviewRecording } = await import('@/lib/s3');

  console.log(`Starting async processing for phone recording ${recordingId}`);

  const recording = await prisma.interviewRecording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    console.error(`Recording ${recordingId} not found`);
    return;
  }

  try {
    // Download and upload audio
    console.log(`Downloading phone audio for recording ${recordingId}`);
    const audioBuffer = await downloadZoomRecording(urls.audioUrl);

    // Determine file extension from URL or default to mp3
    const ext = urls.audioUrl.includes('.m4a') ? 'm4a' : 'mp3';

    const result = await uploadInterviewRecording(
      recording.interviewId,
      audioBuffer,
      'audio',
      ext
    );

    console.log(`Uploaded phone audio to S3: ${result.key}`);

    // Update recording with S3 URL
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: {
        audioUrl: result.url,
        fileSize: result.size,
        status: 'TRANSCRIBING',
        processedAt: new Date(),
      },
    });

    console.log(`Phone recording ${recordingId} uploaded, starting transcription...`);

    // Transcribe audio
    try {
      const { transcribeAudio, mergeAdjacentSegments } = await import('@/lib/whisper');

      console.log(`Transcribing phone audio for recording ${recordingId}`);
      const transcription = await transcribeAudio(audioBuffer, `phone-recording.${ext}`);

      // Merge adjacent segments
      const mergedSegments = mergeAdjacentSegments(transcription.segments);

      // Store transcript
      await prisma.interviewTranscript.create({
        data: {
          recordingId,
          fullText: transcription.fullText,
          segments: JSON.parse(JSON.stringify(mergedSegments)),
        },
      });

      console.log(`Transcript created for phone recording ${recordingId}`);

      // Trigger AI analysis
      try {
        console.log(`Starting AI analysis for phone recording ${recordingId}`);
        await triggerAIAnalysis(recording.interviewId, mergedSegments, transcription.fullText);
        console.log(`AI analysis completed for phone recording ${recordingId}`);
      } catch (aiError) {
        console.error(`AI analysis failed for phone recording ${recordingId}:`, aiError);
      }
    } catch (transcriptError) {
      console.error(`Transcription failed for phone recording ${recordingId}:`, transcriptError);
    }

    // Mark as ready
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: { status: 'READY' },
    });

    console.log(`Phone recording ${recordingId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process phone recording ${recordingId}:`, error);
    await prisma.interviewRecording.update({
      where: { id: recordingId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/**
 * Handle phone.call_recording_transcription_completed event
 * This is called when Zoom's own transcription is ready (alternative to Whisper)
 */
async function handlePhoneTranscriptCompleted(payload: ZoomPhoneTranscriptPayload) {
  const { object } = payload.payload;
  const callId = object.call_id;
  const callerNumber = object.caller_number;
  const calleeNumber = object.callee_number;
  const direction = object.direction;

  console.log(`Processing phone transcription for call ${callId}`);

  // Determine candidate number
  const candidateNumber = direction === 'outbound' ? calleeNumber : callerNumber;

  // Find the interview
  const { interview } = await findInterviewByPhoneNumber(candidateNumber);

  if (!interview) {
    console.log(`No interview found for phone transcription ${callId}`);
    return;
  }

  // Find the existing recording
  const recording = await prisma.interviewRecording.findUnique({
    where: { interviewId: interview.id },
  });

  if (!recording) {
    console.log(`No recording found for interview ${interview.id}`);
    return;
  }

  // If Zoom provides transcript content directly
  if (object.transcript_content?.text) {
    const existingTranscript = await prisma.interviewTranscript.findUnique({
      where: { recordingId: recording.id },
    });

    // Only use Zoom's transcript if we don't already have one (from Whisper)
    if (!existingTranscript) {
      const segments = object.transcript_content.segments?.map((seg) => ({
        speaker: seg.speaker,
        start: seg.start_time,
        end: seg.end_time,
        text: seg.text,
      })) || [];

      await prisma.interviewTranscript.create({
        data: {
          recordingId: recording.id,
          fullText: object.transcript_content.text,
          segments: JSON.parse(JSON.stringify(segments)),
        },
      });

      console.log(`Stored Zoom transcript for recording ${recording.id}`);

      // Trigger AI analysis with Zoom's transcript
      try {
        await triggerAIAnalysis(interview.id, segments, object.transcript_content.text);
      } catch (aiError) {
        console.error(`AI analysis failed for Zoom transcript:`, aiError);
      }
    }
  }

  console.log(`Phone transcription processed for call ${callId}`);
}
