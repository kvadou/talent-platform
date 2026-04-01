'use client';

import { useSearchParams } from 'next/navigation';
import { TemplateEditor } from '@/components/email-templates/TemplateEditor';

export default function NewTemplatePage() {
  const searchParams = useSearchParams();
  const defaultType = searchParams.get('type') || undefined;

  return <TemplateEditor mode="create" defaultType={defaultType} />;
}
