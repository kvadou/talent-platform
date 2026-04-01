import { prisma } from './prisma';
import { deleteCalendarEvent } from './google-calendar';

/**
 * Cancel all upcoming interviews for an application
 * - Deletes Google Calendar events (with attendee notifications)
 * - Returns count of cancelled interviews
 */
export async function cancelApplicationInterviews(applicationId: string): Promise<number> {
  // Get all future interviews with Google Calendar events
  const interviews = await prisma.interview.findMany({
    where: {
      applicationId,
      scheduledAt: { gte: new Date() }, // Only future interviews
      googleEventId: { not: null }
    },
    include: {
      interviewer: {
        select: { id: true }
      }
    }
  });

  if (interviews.length === 0) {
    return 0;
  }

  let cancelledCount = 0;

  for (const interview of interviews) {
    if (interview.googleEventId) {
      try {
        // Delete from Google Calendar (notifies attendees)
        const deleted = await deleteCalendarEvent(
          interview.interviewer.id,
          interview.googleEventId
        );

        if (deleted) {
          // Clear the googleEventId since event is deleted
          await prisma.interview.update({
            where: { id: interview.id },
            data: { googleEventId: null }
          });
          cancelledCount++;
        }
      } catch (error) {
        console.error(`Failed to cancel interview ${interview.id}:`, error);
        // Continue with other interviews even if one fails
      }
    }
  }

  return cancelledCount;
}
