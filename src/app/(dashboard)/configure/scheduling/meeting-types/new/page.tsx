import { redirect } from 'next/navigation';

// The meeting-types page uses a modal for creating new types.
// Redirect to the main page where users can click "New Meeting Type".
export default function NewMeetingTypePage() {
  redirect('/configure/scheduling/meeting-types');
}
