import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { JobDetailSidebar } from '@/components/jobs/JobDetailSidebar';
import { JobDetailHeader } from '@/components/jobs/JobDetailHeader';

async function getJob(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      market: true,
      department: true,
      office: true,
      _count: {
        select: {
          applications: true,
          openings: true,
        },
      },
    },
  });
}

export default async function JobDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return notFound();
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-10">
      {/* Job Header - Full Width */}
      <JobDetailHeader job={job} />

      {/* Content Area with Sidebar */}
      <div className="flex min-h-[calc(100vh-12rem)]">
        {/* Sidebar */}
        <div className="hidden lg:block">
          <JobDetailSidebar jobId={job.id} />
        </div>

        {/* Main Content */}
        <main className="flex-1 bg-gray-50/50 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
