import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  analyzeInterviewTranscript,
  generateQuickSummary,
  ScorecardAttribute,
} from '@/lib/ai-interview-analysis';
import { TranscriptSegment } from '@/lib/whisper';

/**
 * POST /api/interviews/[id]/analyze
 * Trigger AI analysis of an interview transcript
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

  // Get the interview with transcript and related data
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recording: {
        include: {
          transcript: true,
        },
      },
      aiSummary: true,
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
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.recording?.transcript) {
    return NextResponse.json(
      { error: 'No transcript available for analysis' },
      { status: 400 }
    );
  }

  // Check if analysis already exists
  if (interview.aiSummary) {
    return NextResponse.json({
      message: 'Analysis already exists',
      aiSummary: interview.aiSummary,
    });
  }

  const transcript = interview.recording.transcript;
  const segments: TranscriptSegment[] =
    typeof transcript.segments === 'string'
      ? JSON.parse(transcript.segments)
      : (transcript.segments as unknown as TranscriptSegment[]);

  const candidate = interview.application.candidate;
  const job = interview.application.job;

  // Find the matching interview kit for this interview
  const matchingKit = job.interviewKits.find(
    (kit) =>
      kit.type === interview.type ||
      kit.stageId === interview.application.stageId
  );

  // Build attributes list from the interview kit
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

  try {
    let analysisResult;

    if (attributes.length > 0) {
      // Full analysis with attribute ratings
      analysisResult = await analyzeInterviewTranscript(
        {
          fullText: transcript.fullText,
          segments,
        },
        {
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          jobTitle: job.title,
          jobDescription: job.description || undefined,
          interviewType: interview.type,
          attributes,
        }
      );
    } else {
      // Quick summary without attribute analysis
      const quickResult = await generateQuickSummary(
        {
          fullText: transcript.fullText,
          segments,
        },
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
    const aiSummary = await prisma.interviewAISummary.create({
      data: {
        interviewId: id,
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

    return NextResponse.json({
      success: true,
      aiSummary: {
        id: aiSummary.id,
        summary: aiSummary.summary,
        attributeAnalysis: aiSummary.attributeAnalysis,
        recommendation: aiSummary.recommendation,
        recommendationScore: aiSummary.recommendationScore,
        recommendationReason: aiSummary.recommendationReason,
        strengths: aiSummary.strengths,
        concerns: aiSummary.concerns,
        followUpQuestions: aiSummary.followUpQuestions,
      },
    });
  } catch (error) {
    console.error('AI analysis failed:', error);
    return NextResponse.json(
      { error: 'AI analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/interviews/[id]/analyze
 * Re-run analysis (delete existing and create new)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Delete existing analysis
  await prisma.interviewAISummary.deleteMany({
    where: { interviewId: id },
  });

  return NextResponse.json({ success: true, message: 'Analysis deleted' });
}
