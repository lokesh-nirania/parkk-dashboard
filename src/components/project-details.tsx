'use client';

import { useId } from 'react';
import { updateProject } from '@/lib/actions';
import { PROJECT_TYPE_LABEL, type BoardRow, type NamedRef, type ProjectType } from '@/lib/types';
import { InlineForm, Mini, INPUT } from '@/components/inline-form';

/* ============================================================================
 * Everything about a project except when it happens.
 *
 * Names get typed wrong, a vessel gets named a week after the quote goes out,
 * the yard changes. None of that is a lifecycle event and none of it should
 * need one — but all of it lands in the trail, because a scope that changed
 * quietly is the thing nobody can argue about afterwards.
 * ========================================================================== */

const TYPES: ProjectType[] = ['hull_job', 'supervision', 'repair'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AED', 'INR'];

export function EditProjectButton({
  project, clients, shipyards,
}: { project: BoardRow; clients: NamedRef[]; shipyards: NamedRef[] }) {
  const clientList = useId();
  const yardList = useId();

  return (
    <InlineForm
      trigger="Edit"
      title="The job"
      note="A name we have not seen becomes a new client or yard, exactly as on the quote form."
      submit="Save"
      run={(fd) => updateProject(project.id, fd)}
      width={340}
    >
      {(fe) => (
        <>
          <Mini label="Project name" error={fe.name}>
            <input name="name" defaultValue={project.name} className={INPUT} />
          </Mini>

          <Mini label="Client" error={fe.client_name}>
            <input name="client_name" list={clientList} autoComplete="off"
                   defaultValue={project.client_name ?? ''} className={INPUT} />
            <datalist id={clientList}>
              {clients.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </Mini>

          <div className="grid grid-cols-2 gap-2">
            <Mini label="Vessel">
              <input name="vessel_name" defaultValue={project.vessel_name ?? ''} className={INPUT} />
            </Mini>
            <Mini label="Type" error={fe.type}>
              <select name="type" defaultValue={project.type} className={INPUT}>
                {TYPES.map((t) => <option key={t} value={t}>{PROJECT_TYPE_LABEL[t]}</option>)}
              </select>
            </Mini>
          </div>

          <Mini label="Shipyard">
            <input name="shipyard_name" list={yardList} autoComplete="off"
                   defaultValue={project.shipyard_name ?? ''} className={INPUT} />
            <datalist id={yardList}>
              {shipyards.map((y) => <option key={y.id} value={y.name} />)}
            </datalist>
          </Mini>

          <Mini label="Location">
            <input name="location" defaultValue={project.location ?? ''} className={INPUT} />
          </Mini>

          <div className="grid grid-cols-2 gap-2">
            <Mini label="Quote value">
              <input type="number" name="quote_value" min={0} step="0.01"
                     defaultValue={project.quote_value ?? ''} className={INPUT} />
            </Mini>
            <Mini label="Currency">
              <select name="currency" defaultValue={project.currency ?? 'USD'} className={INPUT}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Mini>
          </div>

          <Mini label="Scope">
            <textarea name="scope_note" rows={4} defaultValue={project.scope_note ?? ''}
                      className={INPUT} placeholder="What was actually quoted" />
          </Mini>
        </>
      )}
    </InlineForm>
  );
}
