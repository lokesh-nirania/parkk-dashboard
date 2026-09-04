'use client';

import { useId } from 'react';
import { addSeats, fillSeat, releaseSeat } from '@/lib/actions';
import type { Seat, Worker } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * The crew list, which is the one thing on a project that will not hold still.
 *
 * A seat is a row with a beginning and an end. Filling one in week three writes
 * that person's obligations — visa, flights, pass, cover — which is what sends
 * travel and immigration back to unfinished. Releasing one ends the seat and
 * stops its work counting, without deleting a thing.
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

export function FillSeatButton({
  seat, workers,
}: { seat: Seat; workers: Worker[] }) {
  const listId = useId();

  return (
    <InlineForm
      trigger={seat.worker_id ? 'Replace' : 'Fill seat'}
      title={`Seat ${seat.seat_no}`}
      note="Picking a name writes that person's obligations across immigration, travel, insurance and the yard pass."
      submit={seat.worker_id ? 'Replace' : 'Take the seat'}
      run={(fd) => fillSeat(seat.id, fd)}
      width={300}
    >
      {(fe) => (
        <>
          <Mini label="Worker" error={fe.worker_name}>
            <input
              name="worker_name" list={listId} autoComplete="off" autoFocus
              className={INPUT} placeholder="Ivan Petrov"
            />
            <datalist id={listId}>
              {workers.map((w) => <option key={w.id} value={w.full_name} />)}
            </datalist>
          </Mini>
          <p className="text-[10px] text-faint">
            A name we do not know yet becomes a new crew record.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Mini label="Trade">
              <input name="trade" className={INPUT} placeholder="Blaster" defaultValue={seat.trade === 'Unassigned' ? '' : seat.trade} />
            </Mini>
            <Mini label="Mobilises">
              <input type="date" name="mobilize_on" className={INPUT} defaultValue={seat.mobilize_on ?? ''} />
            </Mini>
          </div>
        </>
      )}
    </InlineForm>
  );
}

export function ReleaseSeatButton({ seat, name }: { seat: Seat; name: string }) {
  const filled = seat.worker_id !== null;
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
