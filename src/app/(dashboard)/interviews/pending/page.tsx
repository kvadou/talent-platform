import { redirect } from 'next/navigation';

export default function PendingInterviewsPage() {
  redirect('/interviews?filter=pending');
}
