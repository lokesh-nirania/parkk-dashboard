import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ChangeEvent } from '@/lib/types';
import { PageHeader, Card, Empty } from '@/components/ui';
import { EventDetail, EventVerb } from '@/components/trail';

export const dynamic = 'force-dynamic';

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function ActivityPage() {
  const supabase = await createClient();

  const [{ data: log }, { data: projects }] = await Promise.all([
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('project_board').select('id, code, name'),
  ]);

  const pMap = new Map((projects ?? []).map((p: { id: string; code: string }) => [p.id, p]));
  const rows = (log ?? []) as ChangeEvent[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        subtitle="Every status change and every date move, appended. Answers “who moved this, when, and why” without a separate audit trail."
      />

      <Card pad={false}>
        {rows.length === 0 && <Empty>Nothing logged yet.</Empty>}
        <ul>
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-4 py-3 text-[13px] last:border-0">
              <span className="tabular w-[70px] shrink-0 text-[11px] text-faint">{ago(e.created_at)}</span>
              {e.project_id && pMap.has(e.project_id) && (
                <Link href={`/projects/${e.project_id}`} className="font-mono text-[11px] text-muted hover:text-ink">
                  {pMap.get(e.project_id)!.code}
                </Link>
              )}
              <EventDetail event={e} />
              <span className="ml-auto flex items-center gap-2">
                <EventVerb action={e.action} />
                <span className="text-[11px] text-faint">{e.actor}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
