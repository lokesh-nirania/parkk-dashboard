import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { ProjectForm } from '@/components/project-form';
import type { NamedRef } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const supabase = await createClient();

  // Both start empty on a fresh database. The comboboxes create as you type,
  // so an empty list is a usable state, not a blocked one.
  const [{ data: clients }, { data: shipyards }] = await Promise.all([
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('shipyards').select('id, name').order('name'),
  ]);

  return (
    <div className="mx-auto max-w-[860px] space-y-6">
      <PageHeader
        title="New project"
        subtitle="Every project starts as a quote. Nothing is planned, and no crew exists, until it is confirmed."
      />
      <ProjectForm
        clients={(clients ?? []) as NamedRef[]}
        shipyards={(shipyards ?? []) as NamedRef[]}
      />
    </div>
  );
}
