'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  ITEM_STATUSES, OPTIONAL_KITS, TERMINAL,
  type ItemStatus, type OwnerParty, type Person, type PersonRole,
  type ProjectStatus, type ProjectType, STATUS_LABEL,
} from '@/lib/types';

/* ============================================================================
 * Every write in the app goes through this file, and every one of them appends
 * to activity_log. With no seed data anywhere, the trail is the evidence that
 * what is on screen was done by somebody.
 *
 * A log row carries two halves. The sentence is what the feed reads. The
 * structured half — entity, field, old_value, new_value — is what makes it a
 * record rather than a story: you cannot ask a sentence how many days a project
 * has slipped, or when travel was last finished before it reopened.
 *
 * A project moves forward one gate at a time. There is no free status dropdown
 * anywhere, and each gate re-checks its own precondition on the server — the
 * button being rendered is not a permission.
 * ========================================================================== */

export type ActionResult = { ok?: true; error?: string; fieldErrors?: Record<string, string> };

const PROJECT_TYPES: ProjectType[] = ['hull_job', 'supervision', 'repair'];
const OWNER_PARTIES: OwnerParty[] = ['us', 'client', 'agency'];

/** The signed-in user's person row, or null. Identity is never taken from the client. */
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null as Person | null };
  const { data } = await supabase
    .from('people').select('*').eq('user_id', user.id).maybeSingle();
  return { supabase, profile: (data as Person) ?? null };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/* ------------------------------------------------------------------ the trail */

type Entity = 'project' | 'substage' | 'task' | 'seat' | 'manager' | 'person' | 'worker';

type Change = {
  entity?: Entity;
  itemId?: string | null;
  field?: string;
  from?: string | number | null;
  to?: string | number | null;
  reason?: string | null;
};

const asText = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? null : String(v);

async function log(
  supabase: Db, profile: Person,
  projectId: string | null, action: string, detail: string, change: Change = {},
) {
  await supabase.from('activity_log').insert({
    project_id: projectId,
    entity: change.entity ?? 'project',
    item_id: change.itemId ?? null,
    actor_id: profile.id,
    actor: profile.full_name,
    action,
    detail,
    field: change.field ?? null,
    old_value: asText(change.from),
    new_value: asText(change.to),
    reason: change.reason?.trim() || null,
  });
}

/**
 * One row per field that actually moved. A batch that changes nothing writes
 * nothing — a trail full of "start date: 12 Mar → 12 Mar" is a trail nobody reads.
 */
type FieldMove = { field: string; from: string | null; to: string | null; label: string };

/** The sentence stays short; the structured columns keep the whole value. */
const short = (v: string | null) =>
  v === null || v === '' ? '—' : v.length > 56 ? `${v.slice(0, 53).trimEnd()}…` : v;

async function logMoves(
  supabase: Db, profile: Person, projectId: string,
  action: string, moves: FieldMove[], reason?: string | null,
) {
  for (const m of moves) {
    await log(
      supabase, profile, projectId, action,
      `${m.label}: ${short(m.from)} → ${short(m.to)}${reason?.trim() ? ` (${reason.trim()})` : ''}`,
      { field: m.field, from: m.from, to: m.to, reason },
    );
  }
}

/* ------------------------------------------------------- substage transitions
 * A substage's status is derived, so nothing writes it and nothing would
 * otherwise record it moving. But "travel was finished on 3 August and reopened
 * on the 15th when Lena joined" is the single most useful sentence this system
 * can produce, so the actions that disturb a substage take a reading either
 * side and log the crossings themselves.
 */

type SubstageState = { id: string; title: string; status: ItemStatus };

async function readSubstages(supabase: Db, projectId: string): Promise<SubstageState[]> {
  const { data } = await supabase
    .from('project_substage_effective')
    .select('id, title, effective_status')
    .eq('project_id', projectId);
  return ((data ?? []) as { id: string; title: string; effective_status: ItemStatus }[])
    .map((s) => ({ id: s.id, title: s.title, status: s.effective_status }));
}

const settled = (s: ItemStatus) => s === 'done' || s === 'n_a';

async function logSubstageMoves(
  supabase: Db, profile: Person, projectId: string,
  before: SubstageState[], why: string,
) {
  const after = await readSubstages(supabase, projectId);
  const wasById = new Map(before.map((s) => [s.id, s]));

  for (const now of after) {
    const was = wasById.get(now.id);
    if (!was || was.status === now.status) continue;

    if (!settled(was.status) && settled(now.status)) {
      await log(supabase, profile, projectId, 'substage_completed',
        `${now.title} complete`,
        { entity: 'substage', itemId: now.id, field: 'status', from: was.status, to: now.status });
    } else if (settled(was.status) && !settled(now.status)) {
      await log(supabase, profile, projectId, 'substage_reopened',
        `${now.title} reopened — ${why}`,
        { entity: 'substage', itemId: now.id, field: 'status',
          from: was.status, to: now.status, reason: why });
    }
  }
}

function refresh(projectId?: string) {
  revalidatePath('/board');
  revalidatePath('/projects');
  revalidatePath('/quotation');
  revalidatePath('/activity');
  revalidatePath('/expiry');
  revalidatePath('/logistics');
  revalidatePath('/crew');
  revalidatePath('/managers');
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/* --------------------------------------------------------- form helpers */

const str = (fd: FormData, k: string) => (fd.get(k) ?? '').toString().trim();
const nullable = (fd: FormData, k: string) => str(fd, k) || null;

function num(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// A date input posts yyyy-mm-dd or nothing. Anything else came from something
// that is not the form, and is not a date this app will store.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function date(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return ISO_DATE.test(v) ? v : null;
}

/** 'Abhishek Rao' → 'Abhishek'. What fits in a table cell. */
const shortNameOf = (full: string) => full.trim().split(/\s+/)[0] ?? full.trim();

/**
 * Pick-or-create. The database starts empty, so a form that only offers a
 * dropdown of existing clients is a form nobody can ever submit. The combobox
 * sends either an id or a typed name; a name we have not seen becomes a row.
 */
async function resolveRef(
  supabase: Db, table: 'clients' | 'shipyards',
  id: string | null, name: string | null, extra: Record<string, unknown> = {},
): Promise<string | null> {
  if (id) return id;
  if (!name) return null;

  const { data: found } = await supabase
    .from(table).select('id').ilike('name', name).maybeSingle();
  if (found) return (found as { id: string }).id;

  const { data: made, error } = await supabase
    .from(table).insert({ name, ...extra }).select('id').single();
  if (error) return null;
  return (made as { id: string }).id;
}

/* ============================================================ 1 · the quote */

/**
 * A quote does not know when the job starts — it says when we think it starts.
 * Both dates go in as estimates and the live dates mirror them, so the T-minus
 * clock has something to count while the quote is open. The confirm gate is
 * what separates the two.
 */
export async function createProject(
  _prev: ActionResult | null, fd: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const name = str(fd, 'name');
  const clientId = nullable(fd, 'client_id');
  const clientName = nullable(fd, 'client_name');
  const location = str(fd, 'location');
  const estStart = date(fd, 'est_start_date');
  const estEnd = date(fd, 'est_end_date');
  const teamSize = num(fd, 'team_size');
  const type = str(fd, 'type') as ProjectType;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Give the project a name.';
  if (!clientId && !clientName) fieldErrors.client_name = 'Who is this for?';
  if (!location) fieldErrors.location = 'Where is the job?';
  if (!estStart) fieldErrors.est_start_date = 'An estimated start date is half of what gets confirmed.';
  if (teamSize === null) fieldErrors.team_size = 'An estimated crew size is the other half.';
  else if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 500) {
    fieldErrors.team_size = 'Between 1 and 500 people.';
  }
  if (estStart && estEnd && estEnd < estStart) {
    fieldErrors.est_end_date = 'The job cannot end before it starts.';
  }
  if (!PROJECT_TYPES.includes(type)) fieldErrors.type = 'Pick a project type.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const resolvedClient = await resolveRef(supabase, 'clients', clientId, clientName);
  if (!resolvedClient) return { fieldErrors: { client_name: 'Could not create that client.' } };

  const shipyardId = await resolveRef(
    supabase, 'shipyards', nullable(fd, 'shipyard_id'), nullable(fd, 'shipyard_name'),
  );

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      client_id: resolvedClient,
      shipyard_id: shipyardId,
      location,
      type,
      status: 'quoted',
      est_start_date: estStart,
      est_end_date: estEnd,
      start_date: estStart,
      end_date: estEnd,
      team_size: teamSize,
      quote_value: num(fd, 'quote_value'),
      currency: str(fd, 'currency') || 'USD',
      scope_note: nullable(fd, 'scope_note'),
      created_by: profile.id,
    })
    .select('id, code, name')
    .single();

  if (error || !project) return { error: error?.message ?? 'Could not create the project.' };
  const p = project as { id: string; code: string; name: string };

  const vesselName = nullable(fd, 'vessel_name');
  if (vesselName) {
    const { data: vessel } = await supabase
      .from('vessels')
      .insert({ name: vesselName, client_id: resolvedClient, imo: nullable(fd, 'imo') })
      .select('id').single();
    if (vessel) {
      await supabase.from('projects')
        .update({ vessel_id: (vessel as { id: string }).id }).eq('id', p.id);
    }
  }

  await log(supabase, profile, p.id, 'project_created',
    `${p.code} ${p.name} — quoted, ${teamSize} crew, estimated start ${estStart}`);

  // Where the estimate started, so a date that moves later has something to
  // have moved from.
  await logMoves(supabase, profile, p.id, 'dates_estimated', [
    { field: 'est_start_date', from: null, to: estStart, label: 'Estimated start' },
    ...(estEnd ? [{ field: 'est_end_date', from: null, to: estEnd, label: 'Estimated end' }] : []),
  ]);

  refresh(p.id);
  redirect(`/projects/${p.id}`);        // throws; nothing below runs
}

/* ----------------------------------------------------- 2 · the confirmation */

/**
 * The gate where an estimate becomes a commitment.
 *
 * The dates and the crew size the client agreed to are stamped in, and the
 * confirmed pair is a baseline that is never written again — which is the only
 * way "this project has slipped nine days" can be a fact rather than a memory.
 */
export async function confirmProject(
  projectId: string, fd: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('projects')
    .select('id, code, status, est_start_date, est_end_date, team_size')
    .eq('id', projectId).maybeSingle();
  if (!data) return { error: 'Project not found' };

  const p = data as {
    id: string; code: string; status: string;
    est_start_date: string | null; est_end_date: string | null; team_size: number | null;
  };
  if (p.status !== 'quoted') return { error: `${p.code} is already past confirmation.` };

  // Defaults are the estimate — confirming a quote nobody argued with should be
  // one click. A field the form did send, blank, means blank: clearing an end
  // date is a thing somebody can mean.
  const start = fd.has('start_date') ? date(fd, 'start_date') : p.est_start_date;
  const end = fd.has('end_date') ? date(fd, 'end_date') : p.est_end_date;
  const teamSize = fd.has('team_size') ? num(fd, 'team_size') : p.team_size;
  const reason = nullable(fd, 'reason');

  const fieldErrors: Record<string, string> = {};
  if (!start) fieldErrors.start_date = 'Set the agreed start date before confirming.';
  if (teamSize === null) fieldErrors.team_size = 'Set the agreed crew size before confirming.';
  else if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 500) {
    fieldErrors.team_size = 'Between 1 and 500 people.';
  }
  if (start && end && end < start) fieldErrors.end_date = 'The job cannot end before it starts.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { error } = await supabase.from('projects').update({
    status: 'confirmed',
    confirmed_by: profile.id,
    confirmed_at: new Date().toISOString(),
    confirmed_start_date: start,
    confirmed_end_date: end,
    start_date: start,
    end_date: end,
    team_size: teamSize,
  }).eq('id', projectId).eq('status', 'quoted');
  if (error) return { error: error.message };

  await log(supabase, profile, projectId, 'project_confirmed',
    `${p.code} confirmed by ${profile.short_name} — ${teamSize} crew from ${start}`,
    { field: 'status', from: 'quoted', to: 'confirmed' });

  // Always logged, even when the confirmed dates match the quote: "confirmed as
  // quoted" is itself the fact, and the history should show the gate.
  await logMoves(supabase, profile, projectId, 'dates_confirmed', [
    { field: 'confirmed_start_date', from: p.est_start_date, to: start, label: 'Start confirmed' },
    { field: 'confirmed_end_date', from: p.est_end_date, to: end, label: 'End confirmed' },
  ], reason);

  if (teamSize !== p.team_size) {
    await log(supabase, profile, projectId, 'team_size_changed',
      `Crew size confirmed at ${teamSize}, quoted ${p.team_size ?? '—'}`,
      { field: 'team_size', from: p.team_size, to: teamSize, reason });
  }

  refresh(projectId);
  return { ok: true };
}

/**
 * Moving the dates, after they exist.
 *
 * While the quote is open this revises the estimate; once confirmed it shifts
 * the live dates against a baseline that does not move — and then it asks why.
 * A slip with no reason recorded is a number nobody can act on three weeks later.
 */
export async function rescheduleProject(
  projectId: string, fd: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('projects')
    .select('id, code, status, start_date, end_date, est_start_date, est_end_date, team_size, scope_note')
    .eq('id', projectId).maybeSingle();
  if (!data) return { error: 'Project not found' };

  const p = data as {
    id: string; code: string; status: ProjectStatus;
    start_date: string | null; end_date: string | null;
    est_start_date: string | null; est_end_date: string | null;
    team_size: number | null; scope_note: string | null;
  };

  if (TERMINAL.includes(p.status)) {
    return { error: `${p.code} is closed. Its dates are history now, not a plan.` };
  }

  const quoting = p.status === 'quoted';
  const start = date(fd, 'start_date');
  const end = date(fd, 'end_date');
  const reason = str(fd, 'reason');

  // Before anybody has agreed to anything, a revision is a revision: the client
  // came back wanting a different window, a different crew, or different work,
  // and usually more than one of the three at once.
  const teamSize = quoting && fd.has('team_size') ? num(fd, 'team_size') : p.team_size;
  const scope = quoting && fd.has('scope_note') ? nullable(fd, 'scope_note') : p.scope_note;

  const fieldErrors: Record<string, string> = {};
  if (!start) fieldErrors.start_date = 'A project needs a start date.';
  if (start && end && end < start) fieldErrors.end_date = 'The job cannot end before it starts.';
  if (quoting) {
    if (teamSize === null) fieldErrors.team_size = 'An estimated crew size is half of what gets confirmed.';
    else if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 500) {
      fieldErrors.team_size = 'Between 1 and 500 people.';
    }
  }
  // Only after confirmation. Moving a quote nobody has agreed to yet is just
  // editing a guess, and demanding a paragraph for it teaches people to type "x".
  if (!quoting && !reason) {
    fieldErrors.reason = 'Say why the dates moved — that is the part worth keeping.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const wasStart = quoting ? p.est_start_date : p.start_date;
  const wasEnd = quoting ? p.est_end_date : p.end_date;
  const nothingMoved = start === wasStart && end === wasEnd
    && (!quoting || (teamSize === p.team_size && (scope ?? '') === (p.scope_note ?? '')));
  if (nothingMoved) return { error: 'Nothing on the quote has changed.' };

  const patch: Record<string, string | number | null> = { start_date: start, end_date: end };
  if (quoting) {
    patch.est_start_date = start;
    patch.est_end_date = end;
    patch.team_size = teamSize;
    patch.scope_note = scope;
  }

  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) return { error: error.message };

  const moves: FieldMove[] = [];
  if (start !== wasStart) {
    moves.push(quoting
      ? { field: 'est_start_date', from: wasStart, to: start, label: 'Estimated start' }
      : { field: 'start_date', from: wasStart, to: start, label: 'Start' });
  }
  if (end !== wasEnd) {
    moves.push(quoting
      ? { field: 'est_end_date', from: wasEnd, to: end, label: 'Estimated end' }
      : { field: 'end_date', from: wasEnd, to: end, label: 'End' });
  }
  if (quoting && teamSize !== p.team_size) {
    moves.push({ field: 'team_size', from: asText(p.team_size), to: asText(teamSize),
                 label: 'Estimated crew' });
  }
  if (quoting && (scope ?? '') !== (p.scope_note ?? '')) {
    moves.push({ field: 'scope_note', from: p.scope_note, to: scope, label: 'Scope' });
  }

  await logMoves(supabase, profile, projectId,
    quoting ? 'estimate_revised' : 'dates_shifted', moves, reason);

  refresh(projectId);
  return { ok: true };
}

/**
 * The other exit, and it is the same exit at every stage.
 *
 * "Lost" claimed to know something this system never learns: quotes go quiet,
 * clients reorganise, yard slots vanish, and a reason typed at the moment of
 * giving up is a guess dressed as data. A project that does not go ahead is
 * cancelled — with a note when somebody genuinely knows why, and without one
 * when they do not.
 */
export async function cancelProject(projectId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('projects').select('code, status').eq('id', projectId).maybeSingle();
  if (!data) return { error: 'Project not found' };
  const p = data as { code: string; status: ProjectStatus };

  if (TERMINAL.includes(p.status)) return { error: `${p.code} is already closed.` };

  const reason = nullable(fd, 'reason');

  const { error } = await supabase.from('projects')
    .update({ status: 'cancelled', cancel_reason: reason })
    .eq('id', projectId).eq('status', p.status);
  if (error) return { error: error.message };

  await log(supabase, profile, projectId, 'project_cancelled',
    `${p.code} cancelled${reason ? ` — ${reason}` : ''}`,
    { field: 'status', from: p.status, to: 'cancelled', reason });

  refresh(projectId);
  return { ok: true };
}

/**
 * Everything a project is, other than when it happens.
 *
 * Names get typed wrong, a vessel gets named after the quote goes out, a yard
 * changes, and the scope somebody wrote in ninety seconds turns out to be the
 * paragraph the whole job is priced on. All of it is editable at any stage, and
 * all of it lands in the trail — a scope that changed silently is the one thing
 * nobody can argue about later.
 */
export async function updateProject(projectId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('project_board')
    .select('id, code, name, type, location, scope_note, quote_value, currency, client_name, vessel_name, shipyard_name')
    .eq('id', projectId).maybeSingle();
  if (!data) return { error: 'Project not found' };

  const p = data as {
    id: string; code: string; name: string; type: ProjectType;
    location: string | null; scope_note: string | null;
    quote_value: number | null; currency: string | null;
    client_name: string | null; vessel_name: string | null; shipyard_name: string | null;
  };

  const name = str(fd, 'name') || p.name;
  const type = (str(fd, 'type') || p.type) as ProjectType;
  const clientName = fd.has('client_name') ? nullable(fd, 'client_name') : p.client_name;
  const vesselName = fd.has('vessel_name') ? nullable(fd, 'vessel_name') : p.vessel_name;
  const shipyardName = fd.has('shipyard_name') ? nullable(fd, 'shipyard_name') : p.shipyard_name;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'A project needs a name.';
  if (!PROJECT_TYPES.includes(type)) fieldErrors.type = 'Pick a project type.';
  if (!clientName) fieldErrors.client_name = 'Who is this for?';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const patch: Record<string, unknown> = {
    name,
    type,
    location: fd.has('location') ? nullable(fd, 'location') : p.location,
    scope_note: fd.has('scope_note') ? nullable(fd, 'scope_note') : p.scope_note,
    quote_value: fd.has('quote_value') ? num(fd, 'quote_value') : p.quote_value,
    currency: str(fd, 'currency') || p.currency,
  };

  // A name we have not seen becomes a row, exactly as it does on the quote form.
  if (clientName !== p.client_name) {
    const clientId = await resolveRef(supabase, 'clients', null, clientName);
    if (!clientId) return { fieldErrors: { client_name: 'Could not create that client.' } };
    patch.client_id = clientId;
  }
  if (shipyardName !== p.shipyard_name) {
    patch.shipyard_id = shipyardName
      ? await resolveRef(supabase, 'shipyards', null, shipyardName)
      : null;
  }
  if (vesselName !== p.vessel_name) {
    if (!vesselName) patch.vessel_id = null;
    else {
      const { data: found } = await supabase
        .from('vessels').select('id').ilike('name', vesselName).maybeSingle();
      if (found) patch.vessel_id = (found as { id: string }).id;
      else {
        const { data: made } = await supabase
          .from('vessels')
          .insert({ name: vesselName, imo: nullable(fd, 'imo'),
                    client_id: (patch.client_id as string) ?? null })
          .select('id').single();
        patch.vessel_id = (made as { id: string } | null)?.id ?? null;
      }
    }
  }

  const labels: Record<string, string> = {
    name: 'Name', type: 'Type', location: 'Location', scope_note: 'Scope',
    quote_value: 'Quote value', currency: 'Currency',
    client_name: 'Client', vessel_name: 'Vessel', shipyard_name: 'Shipyard',
  };

  const was: Record<string, string | number | null> = {
    name: p.name, type: p.type, location: p.location, scope_note: p.scope_note,
    quote_value: p.quote_value, currency: p.currency,
    client_name: p.client_name, vessel_name: p.vessel_name, shipyard_name: p.shipyard_name,
  };
  const now: Record<string, string | number | null> = {
    name, type,
    location: patch.location as string | null,
    scope_note: patch.scope_note as string | null,
    quote_value: patch.quote_value as number | null,
    currency: patch.currency as string | null,
    client_name: clientName, vessel_name: vesselName, shipyard_name: shipyardName,
  };

  const moves: FieldMove[] = Object.keys(labels)
    .filter((k) => String(was[k] ?? '') !== String(now[k] ?? ''))
    .map((k) => ({ field: k, label: labels[k], from: asText(was[k]), to: asText(now[k]) }));

  if (moves.length === 0) return { ok: true };

  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) return { error: error.message };

  await logMoves(supabase, profile, projectId, 'project_updated', moves);

  refresh(projectId);
  return { ok: true };
}

/* ============================================================= 3 · the people */

/**
 * Adding a manager. A person is a record before they are a login: they can be
 * assigned to projects and own workstreams today, and the day an invite is
 * accepted the account attaches to this same row rather than a second one.
 */
export async function addPerson(
  _prev: ActionResult | null, fd: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const fullName = str(fd, 'full_name');
  const email = nullable(fd, 'email');
  const role = (str(fd, 'role') || 'manager') as PersonRole;

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = 'A name, at least.';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = 'That is not an email address.';
  }
  if (role !== 'manager' && role !== 'admin') fieldErrors.role = 'Manager or admin.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { data, error } = await supabase.from('people').insert({
    full_name: fullName,
    short_name: str(fd, 'short_name') || shortNameOf(fullName),
    email,
    phone: nullable(fd, 'phone'),
    role,
    note: nullable(fd, 'note'),
    created_by: profile.id,
  }).select('id, full_name, role').single();

  if (error) {
    return error.code === '23505'
      ? { fieldErrors: { email: 'Somebody already has that email.' } }
      : { error: error.message };
  }
  const person = data as { id: string; full_name: string; role: PersonRole };

  await log(supabase, profile, null, 'person_added',
    `${person.full_name} added as ${person.role}`,
    { entity: 'person', itemId: person.id, field: 'role', to: person.role });

  refresh();
  return { ok: true };
}

export async function setPersonActive(personId: string, active: boolean): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('people').select('id, full_name, is_active, user_id').eq('id', personId).maybeSingle();
  if (!data) return { error: 'Person not found' };
  const person = data as { id: string; full_name: string; is_active: boolean; user_id: string | null };

  if (person.user_id && person.id === profile.id) {
    return { error: 'You cannot deactivate yourself.' };
  }
  if (person.is_active === active) return { ok: true };

  const { error } = await supabase.from('people')
    .update({ is_active: active }).eq('id', personId);
  if (error) return { error: error.message };

  await log(supabase, profile, null,
    active ? 'person_added' : 'person_deactivated',
    `${person.full_name} ${active ? 'reactivated' : 'deactivated'}`,
    { entity: 'person', itemId: person.id, field: 'is_active',
      from: String(person.is_active), to: String(active) });

  refresh();
  return { ok: true };
}

/**
 * Naming the manager — and, the first time, opening planning.
 *
 * This is the gate out of confirmed. Planning does not open because somebody
 * pressed a button called "open planning"; it opens because a person is now
 * answerable for it, which is the fact that actually changes on the ground.
 */
export async function assignManager(projectId: string, personId: string): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const [{ data: proj }, { data: person }] = await Promise.all([
    supabase.from('projects')
      .select('id, code, status, team_size').eq('id', projectId).maybeSingle(),
    supabase.from('people')
      .select('id, full_name, short_name, is_active').eq('id', personId).maybeSingle(),
  ]);
  if (!proj) return { error: 'Project not found' };
  if (!person) return { error: 'Unknown person' };

  const p = proj as { id: string; code: string; status: ProjectStatus; team_size: number | null };
  const who = person as { id: string; full_name: string; short_name: string; is_active: boolean };
  if (!who.is_active) return { error: `${who.full_name} is deactivated.` };

  if (p.status === 'quoted') {
    return { error: `${p.code} is not confirmed yet — confirm the dates and crew size first.` };
  }
  if (TERMINAL.includes(p.status)) return { error: `${p.code} is closed.` };

  // Re-assigning somebody who was taken off before is a fresh assignment, not a
  // second row: the removal stays in the trail.
  const { error: linkErr } = await supabase.from('project_managers').upsert({
    project_id: projectId,
    person_id: personId,
    assigned_at: new Date().toISOString(),
    assigned_by: profile.id,
    removed_at: null,
    removed_by: null,
  }, { onConflict: 'project_id,person_id' });
  if (linkErr) return { error: linkErr.message };

  await log(supabase, profile, projectId, 'manager_assigned',
    `${who.full_name} is managing ${p.code}`,
    { entity: 'manager', itemId: who.id, field: 'manager', to: who.short_name });

  // First manager on a confirmed project opens planning.
  if (p.status === 'confirmed') {
    await supabase.rpc('open_planning', { p_project: projectId });

    // One empty seat per person in the confirmed crew size, so manpower reads
    // 0/12 and goes red without anybody inventing a row. Idempotent: only ever
    // tops up to the confirmed size.
    const { count } = await supabase
      .from('assignments').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const want = p.team_size ?? 0;
    const have = count ?? 0;
    if (want > have) {
      const seats = Array.from({ length: want - have }, (_, i) => ({
        project_id: projectId,
        seat_no: have + i + 1,
        added_by: profile.id,
      }));
      const { error: seatErr } = await supabase.from('assignments').insert(seats);
      if (seatErr) return { error: seatErr.message };
    }

    const { error: statusErr } = await supabase.from('projects').update({
      status: 'planning',
      planning_started_by: profile.id,
      planning_started_at: new Date().toISOString(),
    }).eq('id', projectId).eq('status', 'confirmed');
    if (statusErr) return { error: statusErr.message };

    await log(supabase, profile, projectId, 'planning_opened',
      `${p.code} planning opened — 6 workstreams, ${want} seats`,
      { field: 'status', from: 'confirmed', to: 'planning' });
  }

  refresh(projectId);
  return { ok: true };
}

export async function removeManager(projectId: string, personId: string): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data: person } = await supabase
    .from('people').select('id, full_name, short_name').eq('id', personId).maybeSingle();
  if (!person) return { error: 'Unknown person' };
  const who = person as { id: string; full_name: string; short_name: string };

  const { error } = await supabase.from('project_managers')
    .update({ removed_at: new Date().toISOString(), removed_by: profile.id })
    .eq('project_id', projectId).eq('person_id', personId).is('removed_at', null);
  if (error) return { error: error.message };

  await log(supabase, profile, projectId, 'manager_removed',
    `${who.full_name} came off the project`,
    { entity: 'manager', itemId: who.id, field: 'manager', from: who.short_name, to: null });

  refresh(projectId);
  return { ok: true };
}

/* ========================================================== 4 · the planning */

/** A workstream this job needs that the template does not know about. */
export async function addSubstage(projectId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const title = str(fd, 'title');
  if (!title) return { fieldErrors: { title: 'Name the workstream.' } };

  const { data: proj } = await supabase
    .from('projects').select('id, status').eq('id', projectId).maybeSingle();
  if (!proj) return { error: 'Project not found' };
  if (TERMINAL.includes((proj as { status: ProjectStatus }).status)) {
    return { error: 'That project is closed.' };
  }

  const { data: last } = await supabase
    .from('project_substages').select('seq')
    .eq('project_id', projectId).order('seq', { ascending: false }).limit(1);
  const seq = (((last ?? [])[0] as { seq: number } | undefined)?.seq ?? 0) + 1;

  const { data, error } = await supabase.from('project_substages').insert({
    project_id: projectId,
    stage: 'planning',
    seq,
    title,
    note: nullable(fd, 'note'),
    owner_person_id: nullable(fd, 'owner_person_id'),
    created_by: profile.id,
  }).select('id, title').single();
  if (error) return { error: error.message };

  const s = data as { id: string; title: string };
  await log(supabase, profile, projectId, 'substage_added', `${s.title} added as a workstream`,
    { entity: 'substage', itemId: s.id });

  refresh(projectId);
  return { ok: true };
}

export async function setSubstageStatus(
  substageId: string, status: ItemStatus,
): Promise<ActionResult> {
  if (!ITEM_STATUSES.includes(status)) return { error: 'Unknown status' };

  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('project_substage_effective')
    .select('id, project_id, title, status, total, is_derived')
    .eq('id', substageId).maybeSingle();
  if (!data) return { error: 'Workstream not found' };
  const s = data as {
    id: string; project_id: string; title: string;
    status: ItemStatus; total: number; is_derived: boolean;
  };

  // Once there is something beneath it, a workstream follows it and cannot be
  // typed over. While it is still empty it is settable by hand — which is how a
  // workstream that genuinely does not apply gets closed as n/a. The UI hides
  // the control in the first case; the action does not trust the UI.
  if (s.is_derived) {
    return { error: `"${s.title}" follows the ${s.total} beneath it — change one of those.` };
  }
  if (s.status === status) return { ok: true };

  const { error } = await supabase.from('project_substages')
    .update({ status }).eq('id', substageId);
  if (error) return { error: error.message };

  await log(supabase, profile, s.project_id, 'substage_status_changed',
    `${s.title}: ${STATUS_LABEL[s.status]} → ${STATUS_LABEL[status]}`,
    { entity: 'substage', itemId: s.id, field: 'status', from: s.status, to: status });

  refresh(s.project_id);
  return { ok: true };
}

export async function setSubstageOwner(
  substageId: string, personId: string | null,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('project_substages').select('id, project_id, title, owner_person_id')
    .eq('id', substageId).maybeSingle();
  if (!data) return { error: 'Workstream not found' };
  const s = data as {
    id: string; project_id: string; title: string; owner_person_id: string | null;
  };

  const { error } = await supabase.from('project_substages')
    .update({ owner_person_id: personId }).eq('id', substageId);
  if (error) return { error: error.message };

  let who = 'nobody';
  if (personId) {
    const { data: person } = await supabase
      .from('people').select('short_name').eq('id', personId).maybeSingle();
    who = (person as { short_name: string } | null)?.short_name ?? 'someone';
  }

  await log(supabase, profile, s.project_id, 'substage_owner_changed',
    `${s.title} is now on ${who}`,
    { entity: 'substage', itemId: s.id, field: 'owner_person_id',
      from: s.owner_person_id, to: personId });

  refresh(s.project_id);
  return { ok: true };
}

/* -------------------------------------------------------------- 5 · the work */

export async function addTask(substageId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data: sub } = await supabase
    .from('project_substages').select('id, project_id, title').eq('id', substageId).maybeSingle();
  if (!sub) return { error: 'Workstream not found' };
  const s = sub as { id: string; project_id: string; title: string };

  const title = str(fd, 'title');
  if (!title) return { fieldErrors: { title: 'What is the task?' } };

  const ownerParty = (str(fd, 'owner_party') || 'us') as OwnerParty;
  if (!OWNER_PARTIES.includes(ownerParty)) return { fieldErrors: { owner_party: 'Us, the client or an agency.' } };

  const assignmentId = nullable(fd, 'assignment_id');
  const before = await readSubstages(supabase, s.project_id);

  const { data, error } = await supabase.from('tasks').insert({
    project_id: s.project_id,
    substage_id: s.id,
    assignment_id: assignmentId,
    title,
    subject_label: nullable(fd, 'subject_label'),
    owner_party: ownerParty,
    due_date: date(fd, 'due_date'),
    valid_to: date(fd, 'valid_to'),
    qty_required: num(fd, 'qty_required'),
    qty_done: num(fd, 'qty_done'),
    note: nullable(fd, 'note'),
    created_by: profile.id,
  }).select('id, title').single();
  if (error) return { error: error.message };

  const t = data as { id: string; title: string };
  await log(supabase, profile, s.project_id, 'task_added',
    `${t.title} added to ${s.title}`,
    { entity: 'task', itemId: t.id, field: 'status', to: 'not_started' });

  // Adding work to a finished workstream reopens it, and that crossing is worth
  // a line of its own.
  await logSubstageMoves(supabase, profile, s.project_id, before, `${t.title} added`);

  refresh(s.project_id);
  return { ok: true };
}

/**
 * The leaf write everything above derives from. Moving one visa moves its
 * workstream, the board cell and the commence gate, with nothing recalculated
 * by hand.
 */
export async function setTaskStatus(taskId: string, status: ItemStatus): Promise<ActionResult> {
  if (!ITEM_STATUSES.includes(status)) return { error: 'Unknown status' };

  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('tasks').select('id, project_id, substage_id, title, subject_label, status')
    .eq('id', taskId).maybeSingle();
  if (!data) return { error: 'Task not found' };
  const t = data as {
    id: string; project_id: string; substage_id: string;
    title: string; subject_label: string | null; status: ItemStatus;
  };
  if (t.status === status) return { ok: true };

  const before = await readSubstages(supabase, t.project_id);

  const { error } = await supabase.from('tasks').update({
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await log(supabase, profile, t.project_id, 'task_status_changed',
    `${t.title}${t.subject_label ? ` — ${t.subject_label}` : ''}: ` +
    `${STATUS_LABEL[t.status]} → ${STATUS_LABEL[status]}`,
    { entity: 'task', itemId: t.id, field: 'status', from: t.status, to: status });

  await logSubstageMoves(supabase, profile, t.project_id, before, `${t.title} moved`);

  refresh(t.project_id);
  return { ok: true };
}

/**
 * The rest of a task, after it exists.
 *
 * A visa gets its consulate date a week after somebody wrote it down; sixty
 * drums arrive eighteen at a time. Status alone cannot carry either, and a
 * validity date typed in here can turn the whole workstream red on its own.
 */
export async function updateTask(taskId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('tasks')
    .select('id, project_id, title, subject_label, owner_party, due_date, valid_from, valid_to, qty_required, qty_done, note')
    .eq('id', taskId).maybeSingle();
  if (!data) return { error: 'Task not found' };

  const t = data as {
    id: string; project_id: string; title: string; subject_label: string | null;
    owner_party: OwnerParty; due_date: string | null;
    valid_from: string | null; valid_to: string | null;
    qty_required: number | null; qty_done: number | null; note: string | null;
  };

  const ownerParty = (str(fd, 'owner_party') || t.owner_party) as OwnerParty;
  if (!OWNER_PARTIES.includes(ownerParty)) {
    return { fieldErrors: { owner_party: 'Us, the client or an agency.' } };
  }

  const next = {
    owner_party: ownerParty,
    due_date: fd.has('due_date') ? date(fd, 'due_date') : t.due_date,
    valid_from: fd.has('valid_from') ? date(fd, 'valid_from') : t.valid_from,
    valid_to: fd.has('valid_to') ? date(fd, 'valid_to') : t.valid_to,
    qty_required: fd.has('qty_required') ? num(fd, 'qty_required') : t.qty_required,
    qty_done: fd.has('qty_done') ? num(fd, 'qty_done') : t.qty_done,
    note: fd.has('note') ? nullable(fd, 'note') : t.note,
  };

  if (next.qty_required !== null && next.qty_done !== null && next.qty_done > next.qty_required) {
    return { fieldErrors: { qty_done: 'More received than were ever needed?' } };
  }
  if (next.valid_from && next.valid_to && next.valid_to < next.valid_from) {
    return { fieldErrors: { valid_to: 'Validity cannot end before it starts.' } };
  }

  const labels: Record<string, string> = {
    owner_party: 'Chased with', due_date: 'Needed by', valid_from: 'Valid from',
    valid_to: 'Valid to', qty_required: 'Quantity needed', qty_done: 'Quantity received',
    note: 'Note',
  };

  const moves: FieldMove[] = Object.entries(next)
    .filter(([k, v]) => String(v ?? '') !== String((t as Record<string, unknown>)[k] ?? ''))
    .map(([k, v]) => ({
      field: k,
      from: asText((t as Record<string, string | number | null>)[k]),
      to: asText(v as string | number | null),
      label: `${t.title} — ${labels[k]}`,
    }));

  if (moves.length === 0) return { ok: true };

  const before = await readSubstages(supabase, t.project_id);

  const { error } = await supabase.from('tasks').update(next).eq('id', taskId);
  if (error) return { error: error.message };

  await logMoves(supabase, profile, t.project_id, 'task_updated', moves);

  // A validity date that now falls short of the job end turns the workstream
  // red without anybody touching a status.
  await logSubstageMoves(supabase, profile, t.project_id, before, `${t.title} edited`);

  refresh(t.project_id);
  return { ok: true };
}

/* -------------------------------------------------------------- 6 · the crew */

/** More seats than were confirmed. The crew size grew; the record says so. */
export async function addSeats(projectId: string, count: number): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return { error: 'Between 1 and 50 seats at a time.' };
  }

  const { data: proj } = await supabase
    .from('projects').select('id, code, status').eq('id', projectId).maybeSingle();
  if (!proj) return { error: 'Project not found' };
  const p = proj as { id: string; code: string; status: ProjectStatus };
  if (TERMINAL.includes(p.status)) return { error: `${p.code} is closed.` };

  const { data: last } = await supabase
    .from('assignments').select('seat_no')
    .eq('project_id', projectId).order('seat_no', { ascending: false }).limit(1);
  const from = (((last ?? [])[0] as { seat_no: number } | undefined)?.seat_no ?? 0) + 1;

  const before = await readSubstages(supabase, projectId);

  const { error } = await supabase.from('assignments').insert(
    Array.from({ length: count }, (_, i) => ({
      project_id: projectId, seat_no: from + i, added_by: profile.id,
    })),
  );
  if (error) return { error: error.message };

  await log(supabase, profile, projectId, 'seat_added',
    `${count} seat${count > 1 ? 's' : ''} added — seat ${from}${count > 1 ? `–${from + count - 1}` : ''}`,
    { entity: 'seat', field: 'seats', from: from - 1, to: from + count - 1 });

  await logSubstageMoves(supabase, profile, projectId, before, `${count} seat${count > 1 ? 's' : ''} added`);

  refresh(projectId);
  return { ok: true };
}

/**
 * Putting somebody in a seat — and with it, the obligations they bring.
 *
 * The occupant is a worker off the bench or one of our own managers, because a
 * manager who goes to the yard needs the same permit, bed and pass as the
 * blaster beside them. The form sends `occupant` as `worker:<id>`,
 * `manager:<id>` or nothing at all, in which case the typed name becomes a new
 * crew record.
 *
 * Whoever it is, joining in week three means no permit, no flights and no yard
 * pass, so open_person_tasks writes them and travel, immigration, insurance and
 * the yard pass go back to unfinished. That is not a bug in the plan; it is the
 * plan telling the truth about what just changed.
 */
export async function fillSeat(seatId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data: seat } = await supabase
    .from('assignments')
    .select('id, project_id, seat_no, worker_id, person_id, released_at')
    .eq('id', seatId).maybeSingle();
  if (!seat) return { error: 'Seat not found' };
  const s = seat as {
    id: string; project_id: string; seat_no: number;
    worker_id: string | null; person_id: string | null; released_at: string | null;
  };
  if (s.released_at) return { error: 'That seat has been released. Add a new one instead.' };

  const [kind, ref] = (str(fd, 'occupant') || '').split(':');
  const typedName = nullable(fd, 'worker_name');
  const trade = str(fd, 'trade') || 'Unassigned';

  let occupant: { worker_id: string | null; person_id: string | null; name: string; trade: string };

  if (kind === 'manager' && ref) {
    const { data } = await supabase
      .from('people').select('id, full_name').eq('id', ref).maybeSingle();
    const m = data as { id: string; full_name: string } | null;
    if (!m) return { error: 'Could not find that person.' };
    occupant = { worker_id: null, person_id: m.id, name: m.full_name, trade: trade === 'Unassigned' ? 'Project manager' : trade };
  } else {
    // A worker: an id off the bench, or a name we have not met before.
    let resolved = kind === 'worker' && ref ? ref : null;
    if (!resolved && typedName) {
      const { data: found } = await supabase
        .from('workers').select('id').ilike('full_name', typedName).maybeSingle();
      if (found) resolved = (found as { id: string }).id;
      else {
        const { data: made, error } = await supabase.from('workers')
          .insert({ full_name: typedName, trade, nationality: nullable(fd, 'nationality') })
          .select('id').single();
        if (error) return { error: error.message };
        resolved = (made as { id: string }).id;
      }
    }
    if (!resolved) return { fieldErrors: { worker_name: 'Who is taking the seat?' } };

    const { data: worker } = await supabase
      .from('workers').select('id, full_name, trade').eq('id', resolved).maybeSingle();
    const w = worker as { id: string; full_name: string; trade: string } | null;
    if (!w) return { error: 'Could not find that worker.' };
    occupant = { worker_id: w.id, person_id: null, name: w.full_name, trade: trade !== 'Unassigned' ? trade : w.trade };
  }

  // What this seat does not need. Travel and insurance are never in here:
  // everybody who goes needs a bed and cover, so there is nothing to ask.
  const waived = OPTIONAL_KITS
    .filter((k) => fd.get(`needs_${k.key}`) === null)
    .map((k) => k.key);

  const before = await readSubstages(supabase, s.project_id);

  const { error } = await supabase.from('assignments').update({
    worker_id: occupant.worker_id,
    person_id: occupant.person_id,
    trade: occupant.trade,
    waived_substages: waived,
    filled_at: new Date().toISOString(),
    mobilize_on: date(fd, 'mobilize_on'),
  }).eq('id', seatId);
  if (error) return { error: error.message };

  // The obligation kit: flights, a bed, a transfer, a pass, cover, and a work
  // permit unless this seat was excused one.
  await supabase.rpc('open_person_tasks', { p_assignment: seatId });

  const excused = OPTIONAL_KITS.filter((k) => waived.includes(k.key)).map((k) => k.label.toLowerCase());
  await log(supabase, profile, s.project_id, 'seat_filled',
    `${occupant.name} took seat ${s.seat_no}`
      + (occupant.person_id ? ' — going out as well as running it' : '')
      + (excused.length ? ` — no ${excused.join(' or ')} needed` : ''),
    { entity: 'seat', itemId: s.id, field: 'occupant',
      from: s.worker_id ?? s.person_id, to: occupant.worker_id ?? occupant.person_id });

  await logSubstageMoves(supabase, profile, s.project_id, before, `${occupant.name} joined the crew`);

  refresh(s.project_id);
  return { ok: true };
}

/**
 * Turning one obligation off for one seat, or back on.
 *
 * This is the tag the crew list carries: a local hire needs no work permit, the
 * same person flying to Dubai does, and it is a fact about this job rather than
 * about the person, so it lives on the seat. Turning it off does not delete —
 * the tasks go n/a, anything already finished stays finished, and turning it
 * back on reopens exactly what was set aside.
 */
export async function setSeatKit(
  seatId: string, key: string, required: boolean,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const kit = OPTIONAL_KITS.find((k) => k.key === key);
  if (!kit) return { error: 'Everybody who goes needs that one.' };

  const { data: seat } = await supabase
    .from('seats_effective')
    .select('id, project_id, seat_no, occupant_name, released_at, waived_substages')
    .eq('id', seatId).maybeSingle();
  if (!seat) return { error: 'Seat not found' };
  const s = seat as {
    id: string; project_id: string; seat_no: number; occupant_name: string | null;
    released_at: string | null; waived_substages: string[];
  };
  if (s.released_at) return { error: 'That seat has been released.' };

  const was = !s.waived_substages.includes(key);
  if (was === required) return { ok: true };

  const before = await readSubstages(supabase, s.project_id);

  const { error } = await supabase.rpc('set_person_kit', {
    p_assignment: seatId, p_key: key, p_required: required,
  });
  if (error) return { error: error.message };

  const who = s.occupant_name ?? `Seat ${s.seat_no}`;
  await log(supabase, profile, s.project_id, 'seat_kit_changed',
    required
      ? `${who} needs a ${kit.label.toLowerCase()} after all`
      : `${who} does not need a ${kit.label.toLowerCase()}`,
    { entity: 'seat', itemId: s.id, field: key,
      from: was ? 'required' : 'not needed', to: required ? 'required' : 'not needed' });

  await logSubstageMoves(supabase, profile, s.project_id, before,
    `${who} — ${kit.label.toLowerCase()} ${required ? 'required' : 'waived'}`);

  refresh(s.project_id);
  return { ok: true };
}

/**
 * Taking somebody off the job. The seat is not deleted and their finished work
 * is not rewritten — the seat gets an end date, and everything beneath it stops
 * counting toward what is still outstanding while staying visible in the record.
 */
export async function releaseSeat(seatId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data: seat } = await supabase
    .from('assignments')
    .select('id, project_id, seat_no, worker_id, released_at')
    .eq('id', seatId).maybeSingle();
  if (!seat) return { error: 'Seat not found' };
  const s = seat as {
    id: string; project_id: string; seat_no: number;
    worker_id: string | null; released_at: string | null;
  };
  if (s.released_at) return { error: 'That seat is already released.' };

  const reason = str(fd, 'reason');
  if (!reason) return { fieldErrors: { reason: 'Why are they coming off?' } };

  const { data: occ } = await supabase
    .from('seats_effective').select('occupant_name').eq('id', seatId).maybeSingle();
  const name = (occ as { occupant_name: string | null } | null)?.occupant_name
    ?? `Seat ${s.seat_no}`;

  const before = await readSubstages(supabase, s.project_id);

  const { error } = await supabase.from('assignments').update({
    released_at: new Date().toISOString(),
    release_reason: reason,
    released_by: profile.id,
    demobilize_on: date(fd, 'demobilize_on'),
  }).eq('id', seatId);
  if (error) return { error: error.message };

  await log(supabase, profile, s.project_id, 'seat_released',
    `${name} came off the job — ${reason}`,
    { entity: 'seat', itemId: s.id, field: 'released_at', from: null,
      to: new Date().toISOString().slice(0, 10), reason });

  await logSubstageMoves(supabase, profile, s.project_id, before, `${name} came off the job`);

  refresh(s.project_id);
  return { ok: true };
}

/**
 * The bench. Crew records are usually created by filling a seat — this is for
 * the people you know about before there is a seat to put them in.
 */
export async function addWorker(
  _prev: ActionResult | null, fd: FormData,
): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const fullName = str(fd, 'full_name');
  const trade = str(fd, 'trade');
  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = 'A name, at least.';
  if (!trade) fieldErrors.trade = 'What do they do?';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { data, error } = await supabase.from('workers').insert({
    full_name: fullName,
    trade,
    nationality: nullable(fd, 'nationality'),
    phone: nullable(fd, 'phone'),
    passport_no: nullable(fd, 'passport_no'),
    passport_expiry: date(fd, 'passport_expiry'),
  }).select('id, full_name').single();
  if (error) return { error: error.message };

  const w = data as { id: string; full_name: string };
  await log(supabase, profile, null, 'worker_added', `${w.full_name} added to the crew list`,
    { entity: 'worker', itemId: w.id });

  refresh();
  return { ok: true };
}

/**
 * A passport expiry is not paperwork: a passport running out in four months is
 * a flight nobody takes, and the expiry radar cannot warn about a date it does
 * not have.
 */
export async function updateWorker(workerId: string, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('workers')
    .select('id, full_name, trade, nationality, phone, passport_no, passport_expiry')
    .eq('id', workerId).maybeSingle();
  if (!data) return { error: 'Worker not found' };

  const w = data as {
    id: string; full_name: string; trade: string; nationality: string | null;
    phone: string | null; passport_no: string | null; passport_expiry: string | null;
  };

  const next = {
    full_name: str(fd, 'full_name') || w.full_name,
    trade: str(fd, 'trade') || w.trade,
    nationality: fd.has('nationality') ? nullable(fd, 'nationality') : w.nationality,
    phone: fd.has('phone') ? nullable(fd, 'phone') : w.phone,
    passport_no: fd.has('passport_no') ? nullable(fd, 'passport_no') : w.passport_no,
    passport_expiry: fd.has('passport_expiry') ? date(fd, 'passport_expiry') : w.passport_expiry,
  };

  const labels: Record<string, string> = {
    full_name: 'Name', trade: 'Trade', nationality: 'Nationality',
    phone: 'Phone', passport_no: 'Passport', passport_expiry: 'Passport expiry',
  };

  const moves = Object.entries(next)
    .filter(([k, v]) => String(v ?? '') !== String((w as Record<string, unknown>)[k] ?? ''))
    .map(([k, v]) => ({ field: k, label: labels[k], to: asText(v as string | null),
                        from: asText((w as Record<string, string | null>)[k]) }));
  if (moves.length === 0) return { ok: true };

  const { error } = await supabase.from('workers').update(next).eq('id', workerId);
  if (error) return { error: error.message };

  for (const m of moves) {
    // Passport numbers are not written into the trail — the change is the
    // record, the value is not.
    const shown = m.field === 'passport_no' ? null : m.to;
    await log(supabase, profile, null, 'worker_updated',
      `${w.full_name} — ${m.label}${shown ? `: ${shown}` : ' updated'}`,
      { entity: 'worker', itemId: w.id, field: m.field,
        from: m.field === 'passport_no' ? null : m.from, to: shown });
  }

  refresh();
  return { ok: true };
}

/* ------------------------------------------------------- 7 · the last gate */

/**
 * Commence. The gate has to hold: a project cannot start while a workstream is
 * red, and "red" is the derived status, not whatever anybody typed on the row.
 */
export async function commenceProject(projectId: string): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data: proj } = await supabase
    .from('projects').select('code, status').eq('id', projectId).maybeSingle();
  if (!proj) return { error: 'Project not found' };
  const p = proj as { code: string; status: string };
  if (p.status !== 'planning') return { error: 'Only a project in planning can commence.' };

  const { data: subs } = await supabase
    .from('project_substage_effective')
    .select('title, effective_status')
    .eq('project_id', projectId).eq('stage', 'planning');

  const open = ((subs ?? []) as { title: string; effective_status: ItemStatus }[])
    .filter((s) => !settled(s.effective_status));

  if (open.length) {
    return {
      error: `Planning is not finished — ${open.map((s) => s.title.toLowerCase()).join(', ')}.`,
    };
  }

  const { error } = await supabase.from('projects')
    .update({ status: 'in_progress', commenced_at: new Date().toISOString() })
    .eq('id', projectId).eq('status', 'planning');
  if (error) return { error: error.message };

  await log(supabase, profile, projectId, 'project_commenced',
    `${p.code} commenced by ${profile.short_name}`,
    { field: 'status', from: 'planning', to: 'in_progress' });

  refresh(projectId);
  return { ok: true };
}

/** Demos need an undo. Children cascade. */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const { supabase, profile } = await me();
  if (!profile) return { error: 'Not signed in' };

  const { data } = await supabase
    .from('projects').select('code, name').eq('id', projectId).maybeSingle();
  if (!data) return { error: 'Project not found' };
  const p = data as { code: string; name: string };

  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) return { error: error.message };

  await log(supabase, profile, null, 'project_deleted', `${p.code} ${p.name} deleted`);
  refresh();
  return { ok: true };
}
