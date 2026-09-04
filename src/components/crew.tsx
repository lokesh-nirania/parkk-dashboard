'use client';

import { useState } from 'react';
import { addSeats, fillSeat, releaseSeat, setSeatKit } from '@/lib/actions';
import { OPTIONAL_KITS, type Person, type Seat, type Worker } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * The crew list, which is the one thing on a project that will not hold still.
 *
 * A seat is a row with a beginning and an end, and whoever is in it is crew:
 * a blaster off the bench, or the manager who decided to fly out and run the
 * job from the dock. Filling one in week three writes that person's
 * obligations — flights, a bed, a transfer, a pass, cover, and a permit unless
 * this seat was excused one — which is what sends travel and immigration back
 * to unfinished. Releasing one ends the seat and stops its work counting,
 * without deleting a thing.
 * ========================================================================== */

export function AddSeatsButton({ projectId }: { projectId: string }) {
  return (
    <InlineForm
      trigger="Add seats"
      title="More seats"
      note="The crew grew past what was confirmed. The confirmed number stays where it is; this is what is actually on the job."
      submit="Add"
      run={(fd) => addSeats(projectId, Number(fd.get('count') ?? 1))}
      width={260}
    >
      {() => (
        <Mini label="How many">
          <input type="number" name="count" min={1} max={50} defaultValue={1} className={INPUT} autoFocus />
        </Mini>
      )}
    </InlineForm>
  );
}

const NEW = 'new';

export function FillSeatButton({
  seat, workers, managers,
}: { seat: Seat; workers: Worker[]; managers: Person[] }) {
  const filled = seat.is_filled;

  return (
    <InlineForm
      trigger={filled ? 'Replace' : 'Fill seat'}
      title={`Seat ${seat.seat_no}`}
      note="Whoever takes it gets the obligations that come with going: flights, a bed, a transfer to the yard, a pass and cover."
      submit={filled ? 'Replace' : 'Take the seat'}
      run={(fd) => fillSeat(seat.id, fd)}
      width={320}
    >
      {(fe) => <FillFields seat={seat} workers={workers} managers={managers} fe={fe} />}
    </InlineForm>
  );
}

function FillFields({
  seat, workers, managers, fe,
}: {
  seat: Seat; workers: Worker[]; managers: Person[];
  fe: Record<string, string>;
}) {
  const current = seat.worker_id ? `worker:${seat.worker_id}`
    : seat.person_id ? `manager:${seat.person_id}` : NEW;
  const [who, setWho] = useState(current);

  // Leaving Trade blank is not a blank: the action falls back to whatever this
  // person's own record says. So the placeholder has to be that trade and not a
  // generic example, or the form is quietly promising something else.
  const picked = workers.find((w) => `worker:${w.id}` === who) ?? null;
  const inherited = who.startsWith('manager:') ? 'Project manager' : picked?.trade ?? null;
  const override = seat.trade === 'Unassigned' ? '' : seat.trade;

  return (
    <>
      <Mini label="Who" error={fe.worker_name}>
        <select
          name="occupant" value={who} onChange={(e) => setWho(e.target.value)}
          className={INPUT} autoFocus
        >
          <optgroup label="Crew">
            {workers.map((w) => (
              <option key={w.id} value={`worker:${w.id}`}>{w.full_name} — {w.trade}</option>
            ))}
          </optgroup>
          <optgroup label="Ours, going out">
            {managers.map((m) => (
              <option key={m.id} value={`manager:${m.id}`}>{m.full_name}</option>
            ))}
          </optgroup>
          <option value={NEW}>Somebody not on either list…</option>
        </select>
      </Mini>

      {who === NEW && (
        <>
          <Mini label="Name">
            <input name="worker_name" autoComplete="off" className={INPUT} placeholder="Ivan Petrov" />
          </Mini>
          <p className="text-[10px] text-faint">This becomes a new crew record.</p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Mini label="Trade">
          <input
            // Keyed on the selection: an uncontrolled input reads defaultValue
            // once, so without this it would keep a trade typed for somebody else.
            key={who}
            name="trade" className={INPUT}
            placeholder={inherited ?? 'Blaster'}
            defaultValue={override}
          />
        </Mini>
        <Mini label="Mobilises">
          <input type="date" name="mobilize_on" className={INPUT} defaultValue={seat.mobilize_on ?? ''} />
        </Mini>
      </div>
      <p className="text-[10px] text-faint">
        {inherited && !override
          ? <>Blank records <span className="text-muted">{inherited}</span> — what their own record says. Type here only to override it for this job.</>
          : who === NEW
            ? 'Their trade on the new crew record. Blank leaves it unassigned.'
            : 'Blank keeps whatever their own record says.'}
      </p>

      <fieldset className="space-y-1.5 border-t border-line pt-2">
        <legend className="sr-only">What this seat needs</legend>
        {OPTIONAL_KITS.map((k) => (
          <label key={k.key} className="flex items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox" name={`needs_${k.key}`} defaultChecked={!seat.waived_substages.includes(k.key)}
              className="h-3 w-3 accent-[var(--st-progress)]"
            />
            Needs a {k.label.toLowerCase()} for this job
          </label>
        ))}
        <p className="text-[10px] text-faint">
          Flights, a bed and cover are not a choice — everybody who goes gets them.
        </p>
      </fieldset>
    </>
  );
}

/**
 * The tag on a crew row. Not a form: one click, because "he does not need a
 * visa" is a correction somebody makes while reading the list, and a dialog
 * would mean they leave it wrong instead.
 */
export function KitToggle({ seat, kitKey, label }: { seat: Seat; kitKey: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const required = !seat.waived_substages.includes(kitKey);

  return (
    <button
      type="button"
      disabled={busy}
      title={required
        ? `${label} required — click if this seat does not need one`
        : `No ${label.toLowerCase()} needed — click if it turns out they do`}
      onClick={async () => {
        setBusy(true);
        await setSeatKit(seat.id, kitKey, !required);
        setBusy(false);
      }}
      className={`rounded-full border px-2 py-0.5 text-[10px] leading-none transition ${
        busy ? 'opacity-50' : ''
      } ${required
        ? 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
        : 'border-dashed border-line text-faint line-through hover:text-muted'}`}
    >
      {label}
    </button>
  );
}

export function ReleaseSeatButton({ seat, name }: { seat: Seat; name: string }) {
  const filled = seat.is_filled;
  return (
    <InlineForm
      trigger={filled ? 'Release' : 'Drop seat'}
      title={filled ? `${name} off the job` : `Drop seat ${seat.seat_no}`}
      note={filled
        ? 'The seat keeps its history and its finished work. It stops counting toward what is still outstanding.'
        : 'An empty seat the job turned out not to need. It stays on the record with a reason.'}
      submit="Record it"
      run={(fd) => releaseSeat(seat.id, fd)}
      width={280}
    >
      {(fe) => (
        <>
          <Mini label="Why" error={fe.reason}>
            <input name="reason" className={INPUT} placeholder="Demobilised early — scope cut" autoFocus />
          </Mini>
          <Mini label="Last day">
            <input type="date" name="demobilize_on" className={INPUT} defaultValue={seat.demobilize_on ?? ''} />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}
