import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await getSession();

  if (session?.user?.email) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}

