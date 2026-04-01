import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all AI feedback in the date range
  const feedback = await prisma.aIRecommendationFeedback.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    include: {
      interview: {
        include: {
          application: {
            include: {
              hiringOutcome: true,
              job: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate metrics
  const totalFeedback = feedback.length;
  const helpfulCount = feedback.filter(f => f.wasAIHelpful === true).length;
  const notHelpfulCount = feedback.filter(f => f.wasAIHelpful === false).length;

  // Feedback type breakdown
  const feedbackTypes = {
    AGREE: feedback.filter(f => f.feedbackType === 'AGREE').length,
    DISAGREE_TOO_HIGH: feedback.filter(f => f.feedbackType === 'DISAGREE_TOO_HIGH').length,
    DISAGREE_TOO_LOW: feedback.filter(f => f.feedbackType === 'DISAGREE_TOO_LOW').length,
    PARTIALLY_AGREE: feedback.filter(f => f.feedbackType === 'PARTIALLY_AGREE').length,
    NO_RESPONSE: feedback.filter(f => !f.feedbackType).length,
  };

  // Agreement analysis (AI vs Human recommendation)
  const withBothRecommendations = feedback.filter(f => f.humanRecommendation);
  const exactMatch = withBothRecommendations.filter(
    f => f.aiRecommendation === f.humanRecommendation
  ).length;

  // Score difference analysis
  const scoreDifferences = withBothRecommendations
    .filter(f => f.humanScore !== null)
    .map(f => ({
      aiScore: f.aiScore,
      humanScore: f.humanScore!,
      diff: f.aiScore - f.humanScore!,
    }));

  const avgScoreDiff = scoreDifferences.length > 0
    ? scoreDifferences.reduce((sum, s) => sum + s.diff, 0) / scoreDifferences.length
    : 0;

  // Outcome correlation (when available)
  const withOutcomes = feedback.filter(f => f.interview.application.hiringOutcome);
  const outcomeCorrelation = {
    highScoreHired: 0,
    highScoreNotHired: 0,
    lowScoreHired: 0,
    lowScoreNotHired: 0,
  };

  withOutcomes.forEach(f => {
    const outcome = f.interview.application.hiringOutcome!;
    const isHighScore = f.aiScore >= 70;

    if (outcome.wasHired) {
      if (isHighScore) outcomeCorrelation.highScoreHired++;
      else outcomeCorrelation.lowScoreHired++;
    } else {
      if (isHighScore) outcomeCorrelation.highScoreNotHired++;
      else outcomeCorrelation.lowScoreNotHired++;
    }
  });

  // Commonly incorrect strengths/concerns
  const incorrectStrengths: Record<string, number> = {};
  const incorrectConcerns: Record<string, number> = {};
  const missedStrengths: Record<string, number> = {};
  const missedConcerns: Record<string, number> = {};

  feedback.forEach(f => {
    if (Array.isArray(f.incorrectStrengths)) {
      (f.incorrectStrengths as string[]).forEach(s => {
        incorrectStrengths[s] = (incorrectStrengths[s] || 0) + 1;
      });
    }
    if (Array.isArray(f.incorrectConcerns)) {
      (f.incorrectConcerns as string[]).forEach(c => {
        incorrectConcerns[c] = (incorrectConcerns[c] || 0) + 1;
      });
    }
    if (Array.isArray(f.missedStrengths)) {
      (f.missedStrengths as string[]).forEach(s => {
        missedStrengths[s] = (missedStrengths[s] || 0) + 1;
      });
    }
    if (Array.isArray(f.missedConcerns)) {
      (f.missedConcerns as string[]).forEach(c => {
        missedConcerns[c] = (missedConcerns[c] || 0) + 1;
      });
    }
  });

  // Recent feedback for table
  const recentFeedback = feedback.slice(0, 20).map(f => ({
    id: f.id,
    createdAt: f.createdAt,
    jobTitle: f.interview.application.job.title,
    aiRecommendation: f.aiRecommendation,
    aiScore: f.aiScore,
    humanRecommendation: f.humanRecommendation,
    feedbackType: f.feedbackType,
    wasAIHelpful: f.wasAIHelpful,
    wasHired: f.interview.application.hiringOutcome?.wasHired ?? null,
  }));

  return NextResponse.json({
    summary: {
      totalFeedback,
      helpfulCount,
      notHelpfulCount,
      helpfulRate: totalFeedback > 0 ? (helpfulCount / totalFeedback) * 100 : 0,
      agreementRate: withBothRecommendations.length > 0
        ? (exactMatch / withBothRecommendations.length) * 100
        : 0,
      avgScoreDifference: avgScoreDiff,
    },
    feedbackTypes,
    outcomeCorrelation,
    commonIssues: {
      incorrectStrengths: Object.entries(incorrectStrengths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      incorrectConcerns: Object.entries(incorrectConcerns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      missedStrengths: Object.entries(missedStrengths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      missedConcerns: Object.entries(missedConcerns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    },
    recentFeedback,
    dateRange: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
      days,
    },
  });
}
