import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABEL, type Person } from '@/lib/types';
import { PageHeader, Card, Chip, Empty, QueryError } from '@/components/ui';
import { AddPersonForm, PersonActiveButton } from '@/components/managers';

export const dynamic = 'force-dynamic';

type Load = { person_id: string; project_id: string; code: string; name: string };

/**
 * Parkk's own people, as distinct from the crew.
 *
 * A person here is a record before they are a login: they can be put on a
 * project and own a workstream today, and when invites are switched on the
 * account attaches to this same row. That is why the model has no notion of an
 * "invited but not yet accepted" limbo — the person already exists.
 */
export default async function ManagersPage() {
  const supabase = await createClient();

  const [{ data: peopleRows, error }, { data: assignments }] = await Promise.all([
    supabase.from('people').select('*').order('is_active', { ascending: false }).order('full_name'),
    supabase.from('project_managers')
      .select('person_id, projects(id, code, name, status)')
      .is('removed_at', null),
  ]);

  const people = (peopleRows ?? []) as Person[];

  const loadBy = new Map<string, Load[]>();
  for (const row of (assignments ?? []) as unknown as {
    person_id: string; projects: { id: string; code: string; name: string } | null;
  }[]) {
    if (!row.projects) continue;
    const list = loadBy.get(row.person_id) ?? [];
    list.push({
      person_id: row.person_id,
      project_id: row.projects.id,
      code: row.projects.code,
      name: row.projects.name,
    });
    loadBy.set(row.person_id, list);
  }

  const active = people.filter((p) => p.is_active);
  const inactive = people.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        subtitle="Who can be put on a project. Managers are records today and logins when invites are switched on — the same row either way."
      />

      <QueryError error={error} />

      <Card>
        <h2 className="text-[13px] font-semibold text-ink">Add somebody</h2>
        <p className="mb-3 mt-0.5 text-[12px] text-muted">
          Name and role are enough to start. The email is only where an invite would go.
        </p>
        <AddPersonForm />
      </Card>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[780px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {['Name', 'Role', 'Contact', 'Signs in', 'Running', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr><td colSpan={6}><Empty>
                Nobody yet. The person who signed in is added automatically as an admin.
              </Empty></td></tr>
            )}

            {[...active, ...inactive].map((p) => {
              const load = loadBy.get(p.id) ?? [];
              return (
                <tr key={p.id} className={`border-b border-line last:border-0 ${p.is_active ? '' : 'opacity-55'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{p.full_name}</div>
                    <div className="mt-0.5 text-[11px] text-faint">{p.short_name}</div>
                  </td>
                  <td className="px-4 py-3"><Chip>{ROLE_LABEL[p.role]}</Chip></td>
                  <td className="px-4 py-3 text-muted">
                    <div>{p.email ?? '—'}</div>
                    {p.phone && <div className="mt-0.5 text-[11px] text-faint">{p.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {p.user_id
                      ? <span className="text-muted">yes</span>
                      : <span className="text-faint">not yet — invite pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    {load.length === 0 ? (
                      <span className="text-[12px] text-faint">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {load.map((l) => (
                          <Link key={l.project_id} href={`/projects/${l.project_id}`}
                                className="font-mono text-[11px] text-muted hover:text-ink">
                            {l.code}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right"><PersonActiveButton person={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
