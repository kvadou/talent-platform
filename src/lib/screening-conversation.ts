import { getOpenAI } from './openai';
import { prisma } from './prisma';
import { ScreeningQuestionType, ScreeningDecision, ScreeningMessageRole, Prisma } from '@prisma/client';

type JsonValue = Prisma.JsonValue;

/**
 * Question type for screening
 */
interface ScreeningQuestionData {
  id: string;
  order: number;
  question: string;
  questionType: ScreeningQuestionType;
  options: JsonValue;
  isKnockout: boolean;
  knockoutAnswer: string | null;
  knockoutMessage: string | null;
  evaluationPrompt: string | null;
  minAcceptableScore: number | null;
}

/**
 * Session with all related data for processing
 */
interface ScreeningSession {
  id: string;
  status: string;
  application: {
    candidate: {
      firstName: string;
      lastName: string;
    };
    job: {
      id: string;
      title: string;
    };
  };
  questionSet: {
    questions: ScreeningQuestionData[];
  } | null;
  messages: Array<{
    id: string;
    role: ScreeningMessageRole;
    content: string;
    questionId: string | null;
    questionOrder: number | null;
    aiScore: number | null;
  }>;
}

interface ResponseAnalysis {
  questionId: string | null;
  questionOrder: number | null;
  score: number | null;
  analysis: string | null;
  isKnockout: boolean;
  knockoutReason: string | null;
}

interface ProcessResult {
  aiMessage: {
    id: string;
    content: string;
    role: ScreeningMessageRole;
  };
  analysis: ResponseAnalysis | null;
  sessionUpdate: {
    status: string;
    aiScore: number | null;
    aiRecommendation: ScreeningDecision | null;
    knockoutTriggered: boolean;
    knockoutReason: string | null;
  } | null;
}

/**
 * Process a candidate's response and generate the next AI message
 */
export async function processScreeningResponse(
  session: ScreeningSession,
  candidateResponse: string,
  messageId: string
): Promise<ProcessResult> {
  const openai = getOpenAI();

  // Determine which question we're on based on conversation history
  const currentQuestionOrder = determineCurrentQuestion(session);
  const questions = session.questionSet?.questions || [];
  const currentQuestion = questions.find((q) => q.order === currentQuestionOrder);
  const nextQuestion = questions.find((q) => q.order === currentQuestionOrder + 1);

  // Analyze the candidate's response
  let analysis: ResponseAnalysis | null = null;

  if (currentQuestion) {
    analysis = await analyzeResponse(openai, currentQuestion, candidateResponse, session);

    // Update the candidate's message with analysis
    await prisma.screeningMessage.update({
      where: { id: messageId },
      data: {
        questionId: currentQuestion.id,
        questionOrder: currentQuestion.order,
        aiScore: analysis.score,
        aiAnalysis: analysis.analysis,
      },
    });

    // Check for knockout
    if (analysis.isKnockout) {
      return await handleKnockout(session, currentQuestion, analysis);
    }
  }

  // Determine next action
  if (nextQuestion) {
    // Ask the next question
    const aiContent = generateQuestionMessage(nextQuestion, session.application.candidate.firstName);

    const aiMessage = await prisma.screeningMessage.create({
      data: {
        sessionId: session.id,
        role: 'AI',
        content: aiContent,
        questionId: nextQuestion.id,
        questionOrder: nextQuestion.order,
      },
    });

    await prisma.aIScreeningSession.update({
      where: { id: session.id },
      data: {
        status: 'AWAITING_RESPONSE',
        lastActivityAt: new Date(),
      },
    });

    return {
      aiMessage: { id: aiMessage.id, content: aiContent, role: 'AI' },
      analysis,
      sessionUpdate: null,
    };
  } else {
    // All questions answered - complete the screening
    return await completeScreening(session, analysis);
  }
}

/**
 * Determine which question we're currently on based on conversation
 */
function determineCurrentQuestion(session: ScreeningSession): number {
  // Find the highest question order that has been asked by AI
  const aiMessages = session.messages.filter((m) => m.role === 'AI' && m.questionOrder);
  if (aiMessages.length === 0) return 0;

  const highestAsked = Math.max(...aiMessages.map((m) => m.questionOrder || 0));

  // Check if candidate has responded to this question
  const candidateMessages = session.messages.filter(
    (m) => m.role === 'CANDIDATE' && (!m.questionOrder || m.questionOrder >= highestAsked)
  );

  // If there's a candidate message after the last AI question, we're on that question
  return candidateMessages.length > 0 ? highestAsked : highestAsked;
}

/**
 * Analyze a candidate's response to a question
 */
async function analyzeResponse(
  openai: ReturnType<typeof getOpenAI>,
  question: ScreeningQuestionData,
  response: string,
  session: ScreeningSession
): Promise<ResponseAnalysis> {
  const systemPrompt = `You are analyzing a candidate's response to a screening question for a ${session.application.job.title} position at Acme Talent (a children's chess education company).

Score the response from 0-100 based on quality, relevance, and fit.
Identify any disqualifying answers (knockouts).
Be objective and fair.`;

  const optionsStr = question.questionType === 'MULTIPLE_CHOICE' && question.options && Array.isArray(question.options)
    ? `OPTIONS: ${(question.options as string[]).join(', ')}`
    : '';
  const userPrompt = `QUESTION: ${question.question}
${optionsStr}
${question.evaluationPrompt ? `EVALUATION CRITERIA: ${question.evaluationPrompt}` : ''}
${question.isKnockout ? `KNOCKOUT ANSWER: "${question.knockoutAnswer}" (if they give this answer, they are disqualified)` : ''}

CANDIDATE RESPONSE: "${response}"

Analyze and respond in JSON:
{
  "score": 0-100,
  "analysis": "brief explanation of the score",
  "isKnockout": true/false,
  "knockoutReason": "if knockout, explain why" or null
}

Return ONLY valid JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '{}';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Check for knockout based on exact match if configured
    let isKnockout = result.isKnockout || false;
    let knockoutReason = result.knockoutReason || null;

    if (
      question.isKnockout &&
      question.knockoutAnswer &&
      response.toLowerCase().includes(question.knockoutAnswer.toLowerCase())
    ) {
      isKnockout = true;
      knockoutReason = question.knockoutMessage || `Answer matched knockout criteria: "${question.knockoutAnswer}"`;
    }

    return {
      questionId: question.id,
      questionOrder: question.order,
      score: Math.min(100, Math.max(0, result.score || 50)),
      analysis: result.analysis || null,
      isKnockout,
      knockoutReason,
    };
  } catch (error) {
    console.error('Failed to analyze response:', error);
    return {
      questionId: question.id,
      questionOrder: question.order,
      score: 50, // Neutral score on failure
      analysis: null,
      isKnockout: false,
      knockoutReason: null,
    };
  }
}

/**
 * Generate a natural message asking the next question
 */
function generateQuestionMessage(
  question: ScreeningQuestionData,
  candidateFirstName: string
): string {
  const transitions = [
    'Great, thank you!',
    'Thanks for sharing that.',
    'Appreciate the response!',
    'Got it, thanks!',
    "That's helpful to know.",
  ];

  const transition = transitions[Math.floor(Math.random() * transitions.length)];

  let questionText = question.question;

  // Add options for multiple choice
  if (question.questionType === 'MULTIPLE_CHOICE' && question.options && Array.isArray(question.options)) {
    const optionsList = (question.options as string[]).map((opt: string, i: number) => `${i + 1}. ${opt}`).join('\n');
    questionText += `\n\n${optionsList}`;
  }

  // Add hints for yes/no questions
  if (question.questionType === 'YES_NO') {
    questionText += ' (Yes or No)';
  }

  return `${transition} ${questionText}`;
}

/**
 * Handle a knockout scenario
 */
async function handleKnockout(
  session: ScreeningSession,
  question: ScreeningQuestionData,
  analysis: ResponseAnalysis
): Promise<ProcessResult> {
  const knockoutMessage =
    question.knockoutMessage ||
    `Thank you for your time, ${session.application.candidate.firstName}. Unfortunately, based on your response, this position may not be the right fit at this time. We appreciate your interest in Acme Talent and wish you the best in your job search.`;

  const aiMessage = await prisma.screeningMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: knockoutMessage,
    },
  });

  await prisma.aIScreeningSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      knockoutTriggered: true,
      knockoutReason: analysis.knockoutReason,
      aiScore: 0,
      aiRecommendation: 'REJECT',
      aiNotes: `Knockout triggered on question ${question.order}: ${analysis.knockoutReason}`,
    },
  });

  return {
    aiMessage: { id: aiMessage.id, content: knockoutMessage, role: 'AI' },
    analysis,
    sessionUpdate: {
      status: 'COMPLETED',
      aiScore: 0,
      aiRecommendation: 'REJECT',
      knockoutTriggered: true,
      knockoutReason: analysis.knockoutReason,
    },
  };
}

/**
 * Complete the screening and calculate final score/recommendation
 */
async function completeScreening(
  session: ScreeningSession,
  lastAnalysis: ResponseAnalysis | null
): Promise<ProcessResult> {
  // Calculate average score from all analyzed messages
  const allMessages = await prisma.screeningMessage.findMany({
    where: { sessionId: session.id, role: 'CANDIDATE', aiScore: { not: null } },
    select: { aiScore: true },
  });

  const scores = allMessages.map((m) => m.aiScore!).filter((s) => s !== null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

  // Determine recommendation based on score
  let recommendation: ScreeningDecision;
  if (avgScore >= 70) {
    recommendation = 'ADVANCE';
  } else if (avgScore >= 50) {
    recommendation = 'SCHEDULE_CALL'; // Needs human review
  } else {
    recommendation = 'REJECT';
  }

  // Generate completion message
  let completionMessage: string;
  if (recommendation === 'ADVANCE') {
    completionMessage = `Thank you so much, ${session.application.candidate.firstName}! Your responses have been really helpful. Based on our conversation, we'd love to move forward with your application. Someone from our team will be in touch soon to schedule a phone interview. We're excited to learn more about you!`;
  } else if (recommendation === 'SCHEDULE_CALL') {
    completionMessage = `Thank you for taking the time to answer our questions, ${session.application.candidate.firstName}! We appreciate your interest in Acme Talent. Our team will review your responses and follow up with you soon about next steps.`;
  } else {
    completionMessage = `Thank you for your time today, ${session.application.candidate.firstName}. We've received your responses and will be in touch if there's a match. We appreciate your interest in Acme Talent!`;
  }

  const aiMessage = await prisma.screeningMessage.create({
    data: {
      sessionId: session.id,
      role: 'AI',
      content: completionMessage,
    },
  });

  await prisma.aIScreeningSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      aiScore: avgScore,
      aiRecommendation: recommendation,
      aiNotes: `Completed screening with average score of ${avgScore}/100. ${
        scores.length
      } questions analyzed.`,
    },
  });

  return {
    aiMessage: { id: aiMessage.id, content: completionMessage, role: 'AI' },
    analysis: lastAnalysis,
    sessionUpdate: {
      status: 'COMPLETED',
      aiScore: avgScore,
      aiRecommendation: recommendation,
      knockoutTriggered: false,
      knockoutReason: null,
    },
  };
}

/**
 * Generate the first question to start a screening session
 */
export async function generateFirstQuestion(session: ScreeningSession): Promise<string | null> {
  if (!session.questionSet || session.questionSet.questions.length === 0) {
    return null;
  }

  const firstQuestion = session.questionSet.questions.find((q) => q.order === 1);
  if (!firstQuestion) return null;

  return generateQuestionMessage(firstQuestion, session.application.candidate.firstName).replace(
    /^(Great, thank you!|Thanks for sharing that\.|Appreciate the response!|Got it, thanks!|That's helpful to know\.)\s*/,
    ''
  );
}
