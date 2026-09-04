'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OPTIONAL_KITS, type Person, type Seat, type Task, type Worker } from '@/lib/types';
import { Chip, Empty, fmtDate } from '@/components/ui';
import { Sheet } from '@/components/sheet';
import { TaskTable } from '@/components/task-table';
import { FillSeatButton, KitToggle, ReleaseSeatButton } from '@/components/crew';

/* ============================================================================
 * The crew list on a project, and one seat opened up.
 *
 * Clicking a name used to leave the project for that person's own page, which
 * answers a different question: their record spans every job they have held,
 * and what you wanted was this seat on this job. The panel is scoped to the
 * project and links out to the record for the rest.
 * ========================================================================== */

function stamp(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function CrewTable({
  seats, tasks, workers, managers, onOpenSeat,
}: {
  seats: Seat[];
  tasks: Task[];
  workers: Worker[];
  managers: Person[];
  /** Omitted inside a panel, where opening a second one would stack. */
  onOpenSeat?: (seat: Seat) => void;
}) {
  const live = seats.filter((s) => s.is_live);
  const released = seats.filter((s) => !s.is_live);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line text-left">
            {['Seat', 'Who', 'Trade', 'Mobilises', 'Needs', 'Obligations', ''].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {seats.length === 0 && (
            <tr><td colSpan={7}><Empty>No seats yet.</Empty></td></tr>
          )}

          {[...live, ...released].map((s) => {
            const mine = tasks.filter((t) => t.assignment_id === s.id);
            const open = mine.filter((t) => t.status !== 'done' && t.status !== 'n_a').length;
            const gone = !s.is_live;

            return (
              <tr key={s.id} className={`border-b border-line last:border-0 ${gone ? 'opacity-55' : ''}`}>
                <td className="tabular px-4 py-2.5 text-muted">{s.seat_no}</td>
                <td className="px-4 py-2.5">
                  {s.occupant_name ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {onOpenSeat ? (
                        <button
                          type="button" onClick={() => onOpenSeat(s)}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {s.occupant_name}
                        </button>
                      ) : (
                        <span className="font-medium text-ink">{s.occupant_name}</span>
                      )}
                      {s.occupant_kind === 'manager' && (
                        <Chip title="One of ours, going out on the job">ours</Chip>
                      )}
                    </span>
                  ) : (
                    <span className="text-faint">unfilled</span>
                  )}
                  {gone && (
                    <div className="mt-0.5 text-[11px] text-faint">
                      off {stamp(s.released_at!)} — {s.release_reason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{s.trade}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(s.mobilize_on)}</td>
                {/* What this seat needs for this job. Travel is not here:
                    everybody who goes gets a flight, a bed and a transfer. */}
                <td className="px-4 py-2.5">
                  {!s.is_filled ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      {OPTIONAL_KITS.map((k) => (
                        gone
                          ? <span key={k.key} className={`text-[10px] ${s.waived_substages.includes(k.key) ? 'text-faint line-through' : 'text-muted'}`}>{k.label}</span>
                          : <KitToggle key={k.key} seat={s} kitKey={k.key} label={k.label} />
                      ))}
                    </span>
                  )}
                </td>
                <td className="tabular px-4 py-2.5 text-muted">
                  {mine.length === 0 ? '—' : gone ? `${mine.length} on file` : `${mine.length - open}/${mine.length}`}
                </td>
                <td className="px-4 py-2.5">
                  {!gone && (
                    <div className="flex items-center justify-end gap-1.5">
                      <FillSeatButton seat={s} workers={workers} managers={managers} />
                      <ReleaseSeatButton seat={s} name={s.occupant_name ?? `Seat ${s.seat_no}`} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CrewPanel({
  seats, tasks, workers, managers, projectEndDate,
}: {
  seats: Seat[];
  tasks: Task[];
  workers: Worker[];
  managers: Person[];
  projectEndDate: string | null;
}) {
  const [seatId, setSeatId] = useState<string | null>(null);
  // Read the seat back out of the list rather than holding it: an action inside
  // the panel revalidates the page, and this way the panel shows the new row
  // rather than the one captured when it opened.
  const seat = seats.find((s) => s.id === seatId) ?? null;
  const mine = seat ? tasks.filter((t) => t.assignment_id === seat.id) : [];

  return (
    <>
      <div className="rounded-lg border border-line bg-surface">
        <CrewTable
          seats={seats} tasks={tasks} workers={workers} managers={managers}
          onOpenSeat={(s) => setSeatId(s.id)}
        />
      </div>

      <Sheet
        open={seat !== null}
        onClose={() => setSeatId(null)}
        eyebrow={seat ? `Seat ${seat.seat_no}${seat.is_live ? '' : ' · released'}` : ''}
        title={seat ? (
          <>
            {seat.occupant_name ?? `Seat ${seat.seat_no}`}
            {seat.occupant_kind === 'manager' && <Chip title="One of ours, going out on the job">ours</Chip>}
            <span className="text-[12px] font-normal text-muted">{seat.trade}</span>
          </>
        ) : ''}
        actions={seat && seat.is_live ? (
          <>
            <FillSeatButton seat={seat} workers={workers} managers={managers} />
            <ReleaseSeatButton seat={seat} name={seat.occupant_name ?? `Seat ${seat.seat_no}`} />
          </>
        ) : null}
        width={900}
      >
        {seat && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-5 py-3 text-[12px]">
              <Fact label="Mobilises">{fmtDate(seat.mobilize_on)}</Fact>
              <Fact label="Demobilises">{fmtDate(seat.demobilize_on)}</Fact>
              <Fact label="Needs">
                {seat.is_filled ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {OPTIONAL_KITS.map((k) => (
                      seat.is_live
                        ? <KitToggle key={k.key} seat={seat} kitKey={k.key} label={k.label} />
                        : <span key={k.key} className={seat.waived_substages.includes(k.key) ? 'text-faint line-through' : 'text-muted'}>{k.label}</span>
                    ))}
                  </span>
                ) : '—'}
              </Fact>
              {seat.occupant_kind === 'worker' && seat.occupant_id && (
                <Link href={`/crew/${seat.occupant_id}`} className="ml-auto text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline">
                  Full record, every job →
                </Link>
              )}
            </div>

            {!seat.is_live && (
              <p className="border-b border-line bg-surface-2 px-5 py-2.5 text-[12px] text-muted">
                Off the job since {stamp(seat.released_at!)} — {seat.release_reason}. Finished work
                stays on the record; none of it counts toward what is still outstanding.
              </p>
            )}

            <TaskTable
              tasks={mine}
              projectEndDate={projectEndDate}
              empty={seat.is_filled
                ? 'Nothing owed against this seat.'
                : 'An empty seat owes nothing. Filling it writes the obligations that come with going.'}
            />
          </>
        )}
      </Sheet>

    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.06em] text-faint">{label}</span>
      <span className="text-muted">{children}</span>
    </span>
  );
}
