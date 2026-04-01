import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getRecordingStreamUrl } from '@/lib/s3';

/**
 * GET /api/interviews/[id]/recording
 * Get signed streaming URLs for interview recording
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recording: true,
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.recording) {
    return NextResponse.json({ error: 'No recording found' }, { status: 404 });
  }

  const recording = interview.recording;

  // Generate signed URLs for streaming
  let videoStreamUrl: string | null = null;
  let audioStreamUrl: string | null = null;

  if (recording.videoUrl) {
    // Extract S3 key from URL or stored key
    const videoKey = extractS3Key(recording.videoUrl);
    if (videoKey) {
      videoStreamUrl = await getRecordingStreamUrl(videoKey, 3600); // 1 hour expiry
    }
  }

  if (recording.audioUrl) {
    const audioKey = extractS3Key(recording.audioUrl);
    if (audioKey) {
      audioStreamUrl = await getRecordingStreamUrl(audioKey, 3600);
    }
  }

  return NextResponse.json({
    id: recording.id,
    status: recording.status,
    videoUrl: videoStreamUrl || recording.videoUrl,
    audioUrl: audioStreamUrl || recording.audioUrl,
    duration: recording.duration,
    recordedAt: recording.recordedAt,
    processedAt: recording.processedAt,
  });
}

/**
 * Extract S3 key from a full S3 URL
 */
function extractS3Key(url: string): string | null {
  try {
    // Handle both S3 URLs and direct keys
    if (url.startsWith('recordings/')) {
      return url;
    }

    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.slice(1);
  } catch {
    return null;
  }
}

/**
 * POST /api/interviews/[id]/recording
 * Manually trigger recording processing (for retries or manual uploads)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recording: true,
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // If providing a Zoom meeting ID, fetch and process recordings
  if (body.zoomMeetingId) {
    const { getZoomMeetingRecordings, downloadZoomRecording } = await import('@/lib/zoom');
    const { uploadInterviewRecording } = await import('@/lib/s3');

    const recordings = await getZoomMeetingRecordings(body.zoomMeetingId);
    if (!recordings || recordings.recording_files.length === 0) {
      return NextResponse.json(
        { error: 'No recordings found for this Zoom meeting' },
        { status: 404 }
      );
    }

    // Create or update recording record
    let recording = interview.recording;
    if (!recording) {
      recording = await prisma.interviewRecording.create({
        data: {
          interviewId: id,
          zoomMeetingId: body.zoomMeetingId,
          status: 'DOWNLOADING',
          recordedAt: new Date(recordings.start_time),
        },
      });
    } else {
      await prisma.interviewRecording.update({
        where: { id: recording.id },
        data: {
          zoomMeetingId: body.zoomMeetingId,
          status: 'DOWNLOADING',
        },
      });
    }

    // Find video and audio files
    const videoFile = recordings.recording_files.find(
      (f) => f.file_type === 'MP4' || f.recording_type === 'shared_screen_with_speaker_view'
    );
    const audioFile = recordings.recording_files.find(
      (f) => f.file_type === 'M4A' || f.recording_type === 'audio_only'
    );

    try {
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (videoFile) {
        const videoBuffer = await downloadZoomRecording(videoFile.download_url);
        const result = await uploadInterviewRecording(id, videoBuffer, 'video', 'mp4');
        videoUrl = result.url;
      }

      if (audioFile) {
        const audioBuffer = await downloadZoomRecording(audioFile.download_url);
        const result = await uploadInterviewRecording(id, audioBuffer, 'audio', 'm4a');
        audioUrl = result.url;
      }

      await prisma.interviewRecording.update({
        where: { id: recording.id },
        data: {
          videoUrl,
          audioUrl,
          status: 'READY',
          processedAt: new Date(),
          duration: recordings.duration * 60, // Convert minutes to seconds
        },
      });

      return NextResponse.json({
        success: true,
        recordingId: recording.id,
        videoUrl,
        audioUrl,
      });
    } catch (error) {
      await prisma.interviewRecording.update({
        where: { id: recording.id },
        data: { status: 'FAILED' },
      });

      console.error('Failed to process recording:', error);
      return NextResponse.json(
        { error: 'Failed to process recording' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'zoomMeetingId is required' },
    { status: 400 }
  );
}
