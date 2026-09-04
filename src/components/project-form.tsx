'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProject } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { PROJECT_TYPE_LABEL, type NamedRef, type ProjectType } from '@/lib/types';
import { Combobox } from '@/components/combobox';

const FIELD =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-line-strong';

function Field({
  label, name, children, hint, error, required,
}: {
  label: string; name?: string; children: React.ReactNode;
  hint?: string; error?: string; required?: boolean;
}) {
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-1 block text-[12px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-faint">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px]" style={{ color: 'var(--st-blocked)' }}>{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

function Section({
  title, note, children, cols = 2,
}: { title: string; note?: string; children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
      </div>
      <div className={`grid gap-3.5 ${cols === 2 ? 'sm:grid-cols-2' : ''}`}>{children}</div>
    </section>
  );
}

const TYPES: ProjectType[] = ['hull_job', 'supervision', 'repair'];

export function ProjectForm({
  clients, shipyards,
}: { clients: NamedRef[]; shipyards: NamedRef[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createProject, null,
  );
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p
          className="st-blocked rounded-md px-3 py-2 text-[12px]"
          style={{ color: 'var(--c)', background: 'var(--c-bg)' }}
        >
          {state.error}
        </p>
      )}

      <Section title="The job" note="Who it is for, and what it is.">
        <Field label="Project name" name="name" required error={fe.name}
               hint="How everyone will refer to it. The code is generated.">
          <input id="name" name="name" className={FIELD} placeholder="MV Silver Dawn — Rotterdam" />
        </Field>

        <Combobox
          name="client_name" label="Client" required noun="client" options={clients}
          placeholder="Nordkapp Shipping AS" error={fe.client_name}
        />

        <Field label="Vessel" name="vessel_name" hint="Optional — not every job has one named yet.">
          <input id="vessel_name" name="vessel_name" className={FIELD} placeholder="MV Silver Dawn" />
        </Field>

        <Field label="Type" name="type" required error={fe.type}>
          <select id="type" name="type" defaultValue="hull_job" className={FIELD}>
            {TYPES.map((t) => <option key={t} value={t}>{PROJECT_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Scope" name="scope_note" hint="One or two lines. What was actually quoted.">
            <textarea
              id="scope_note" name="scope_note" rows={2} className={FIELD}
              placeholder="Full hull blast and recoat, 4200 m². Boot-top and topsides. 3 coats."
            />
          </Field>
        </div>
      </Section>

      {/*
        Dates and team size are the two things the client actually agrees to at
        confirmation, and everything downstream is sized from them — the seats,
        the T-minus clock, the whole readiness race. On a quote they are still
        estimates, and the form says so: nothing here is a commitment until
        somebody passes the confirm gate, and what changes between the two is
        recorded rather than overwritten.
      */}
      <Section
        title="Estimated dates and team size"
        note="What the quote proposes. Confirmation is what turns these into a commitment — and the difference between the two is kept."
      >
        <Field
          label="Estimated start date" name="est_start_date" required error={fe.est_start_date}
          hint="Runs the T−minus clock until the confirmed date replaces it."
        >
          <input id="est_start_date" name="est_start_date" type="date" className={FIELD} />
        </Field>

        <Field label="Estimated end date" name="est_end_date" error={fe.est_end_date}
               hint="Used to catch passes and visas that expire mid-job.">
          <input id="est_end_date" name="est_end_date" type="date" className={FIELD} />
        </Field>

        <Field
          label="Estimated team size" name="team_size" required error={fe.team_size}
          hint="Confirming it is what sizes the job; opening planning turns it into one unfilled seat per person."
        >
          <input
            id="team_size" name="team_size" type="number" min={1} max={500} step={1}
            className={FIELD} placeholder="12"
          />
        </Field>

        <Field label="Location" name="location" required error={fe.location}
               hint="City and country. The yard can come later.">
          <input id="location" name="location" className={FIELD} placeholder="Rotterdam, Netherlands" />
        </Field>

        <div className="sm:col-span-2">
          <Combobox
            name="shipyard_name" label="Shipyard" noun="shipyard" options={shipyards}
            placeholder="Damen Verolme"
          />
        </div>
      </Section>

      <Section title="The quote" note="Optional. Nothing downstream depends on it.">
        <Field label="Quote value" name="quote_value">
          <input id="quote_value" name="quote_value" type="number" min={0} step="0.01"
                 className={FIELD} placeholder="842000" />
        </Field>
        <Field label="Currency" name="currency">
          <select id="currency" name="currency" defaultValue="USD" className={FIELD}>
            {['USD', 'EUR', 'GBP', 'SGD', 'AED', 'INR'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </Section>

      <div className="flex items-center gap-2.5">
        <button
          type="submit" disabled={pending}
          className="inline-flex items-center rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create quote'}
        </button>
        <Link href="/quotation" className="text-[13px] text-muted hover:text-ink">Cancel</Link>
        <span className="ml-auto text-[11px] text-faint">
          Lands in the pipeline as <strong className="font-medium text-muted">Quoted</strong>, pending confirmation.
        </span>
      </div>
    </form>
  );
}
