/* ============================================================================
 * The demo, created the way a user creates it.
 *
 *   npm run build && npm run start      # the ids come from the running build
 *   node seed/demo.mjs                  # against an empty database
 *   docker exec -i supabase_db_parkk-dashboard psql -U postgres -f - < seed/backdate.sql
 *
 * Every line below is a server action — the same POST the browser sends — so
 * the gates, the validation and the trail all behave exactly as they do for
 * anything typed in by hand. Nothing here inserts a row directly.
 *
 * See seed.md for what this builds and why each project is shaped the way it is.
 * ========================================================================== */

import { call, fd, one, rows, iso } from './drive.mjs';

const P = (code) => one(`select id from projects where code='${code}'`);
const sub = (p, k) => one(`select id from project_substages where project_id='${p}' and template_key='${k}'`);
const seats = (p) => rows(`select id from assignments where project_id='${p}' and released_at is null order by seat_no`);
// Filling a seat the way the form does: an id off a list, or a name we do not
// know yet. needs_immigration is the per-seat tag, and omitting it is the same
// as leaving the box unticked — this seat needs no work permit for this job.
const fill = (o) => fd({ occupant: o.occupant ?? 'new', ...o });
const task = (p, k, who, title) => one(
  `select t.id from tasks t join project_substages s on s.id=t.substage_id
     join seats_effective a on a.id=t.assignment_id
    where t.project_id='${p}' and s.template_key='${k}' and t.title='${title}'
      and a.occupant_name='${who}'`);
const kit = (p, k, like) => one(`select id from tasks where substage_id='${sub(p,k)}' and title like '${like}'`);
const state = (p, k) => one(`select effective_status||' '||done||'/'||total from project_substage_effective where id='${sub(p,k)}'`);

/* ---------------------------------------------------------------- 0 · people */
await call('addPerson', [null, fd({ full_name: 'Rahul Iyer', short_name: 'Rahul',
  email: 'rahul.i@parkk.example', phone: '+91 99000 44556', role: 'manager' })], '/managers');
const rahul = one("select id from people where short_name='Rahul'");
const abhi = one("select id from people where email='abhishek.parkk@example.com'");
const varsha = one("select id from people where email='varsha.parkk@example.com'");

/* ============================================== 1 · PK-26001 · MV Silver Dawn */
await call('createProject', [null, fd({
  name: 'MV Silver Dawn — Rotterdam', client_name: 'Nordkapp Shipping AS',
  vessel_name: 'MV Silver Dawn', imo: '9412783', type: 'hull_job',
  location: 'Rotterdam, Netherlands', shipyard_name: 'Damen Verolme',
  est_start_date: iso(34), est_end_date: iso(56), team_size: '6',
  quote_value: '842000', currency: 'EUR',
  scope_note: 'Full hull blast to Sa2.5 and recoat, 4200 m². Boot-top and topsides, three coats. Includes staging and containment.',
})], '/projects/new');
const dawn = P('PK-26001'), dawnPage = `/projects/${dawn}`;

await call('confirmProject', [dawn, fd({ start_date: iso(38), end_date: iso(60), team_size: '6',
  reason: 'Client moved the docking window' })], dawnPage);
await call('assignManager', [dawn, varsha], dawnPage);
await call('assignManager', [dawn, abhi], dawnPage);

// A Rotterdam job: the EU passports need no permit and the rest do, which is a
// fact about this job rather than about the person. Everybody needs a bed.
const crew = [
  ['Ivan Petrov', 'Blaster', 'Ukrainian', '+380 67 220 4471', 'X4471902', iso(760), true],
  ['Marco Silva', 'Painter', 'Brazilian', '+55 21 99233 8890', 'P2298311', iso(420), true],
  ['Anders Holm', 'Blaster', 'Norwegian', '+47 900 21 553', 'N1180234', iso(118), false],
  ['Piotr Nowak', 'Painter', 'Polish', '+48 601 220 118', 'PL9920881', iso(640), false],
  ['Rui Alves', 'Supervisor', 'Portuguese', '+351 92 887 1120', 'P7741009', iso(980), false],
];
const ds = seats(dawn);
for (let i = 0; i < crew.length; i++)
  await call('fillSeat', [ds[i][0], fill({ worker_name: crew[i][0], trade: crew[i][1],
    mobilize_on: iso(36), needs_immigration: crew[i][6] ? 'on' : undefined })], dawnPage);
for (const [name, , nationality, phone, passport_no, passport_expiry] of crew)
  await call('updateWorker', [one(`select id from workers where full_name='${name}'`),
    fd({ nationality, phone, passport_no, passport_expiry })], '/crew');

// The manager is going out too. She holds the last confirmed seat and gets the
// same flights, bed, transfer, pass and permit as anybody else on the job.
await call('fillSeat', [ds[5][0], fill({ occupant: `manager:${varsha}`,
  trade: 'Project manager', mobilize_on: iso(34), needs_immigration: 'on' })], dawnPage);
const varshaName = one(`select full_name from people where id='${varsha}'`);

// the permits: one through, one filed and silent, one refused
for (const [who, st] of [['Ivan Petrov','done'],[varshaName,'awaiting_external']])
  await call('setTaskStatus', [task(dawn,'immigration',who,'Work permit / visa'), st], dawnPage);
const marcoVisa = task(dawn, 'immigration', 'Marco Silva', 'Work permit / visa');
await call('setTaskStatus', [marcoVisa, 'blocked'], dawnPage);
await call('updateTask', [marcoVisa, fd({ due_date: iso(20), owner_party: 'agency',
  note: 'Refused on first sitting — agency appealing, hearing on the 22nd.' })], dawnPage);

// travel finished, insurance in place, passes issued — for the manager too
const dawnGoers = [...crew.map((c) => c[0]), varshaName];
for (const who of dawnGoers) {
  for (const leg of ['Inbound flight', 'Outbound flight', 'Accommodation', 'Airport transfer'])
    await call('setTaskStatus', [task(dawn,'travel',who,leg), 'done'], dawnPage);
  await call('setTaskStatus', [task(dawn,'insurance',who,'Cover in place'), 'done'], dawnPage);
  const pass = task(dawn, 'yard_pass', who, 'Yard pass & induction');
  await call('setTaskStatus', [pass, 'done'], dawnPage);
  await call('updateTask', [pass, fd({ valid_from: iso(36), valid_to: iso(66) })], dawnPage);
}
// ...except one issued as a 30-day pass
await call('updateTask', [task(dawn,'yard_pass','Rui Alves','Yard pass & induction'), fd({
  valid_to: iso(51),
  note: 'Issued as a 30-day pass rather than a project pass — nine days short of the job.',
})], dawnPage);

// the kit
const dlog = sub(dawn, 'logistics');
for (const t of [
  { title: '60 drums epoxy primer', qty_required: 60, qty_done: 18, due_date: iso(24),
    note: 'Sea freight from Antwerp. 18 landed, balance on the 19th.' },
  { title: 'Blast grit — 14 tonnes', qty_required: 14, qty_done: 14, due_date: iso(26) },
  { title: 'Dehumidifier hire — 2 units', due_date: iso(30), owner_party: 'agency' },
]) await call('addTask', [dlog, fd(t)], dawnPage);
await call('setTaskStatus', [kit(dawn,'logistics','Blast grit%'), 'done'], dawnPage);
await call('setTaskStatus', [kit(dawn,'logistics','Dehumidifier%'), 'awaiting_external'], dawnPage);
await call('setTaskStatus', [kit(dawn,'logistics','60 drums%'), 'in_progress'], dawnPage);

// week three: a body is added, and travel is not finished any more
await call('addSeats', [dawn, 1], dawnPage);
const seat7 = one(`select id from assignments where project_id='${dawn}' order by seat_no desc limit 1`);
// Nobody knows her nationality when the seat is filled, so the permit box stays
// ticked — the safe default. Travel, insurance and immigration all reopen.
await call('fillSeat', [seat7, fill({ worker_name: 'Lena Fischer', trade: 'Painter',
  mobilize_on: iso(40), needs_immigration: 'on' })], dawnPage);
await call('updateWorker', [one("select id from workers where full_name='Lena Fischer'"),
  fd({ nationality: 'German', phone: '+49 151 220 118', passport_no: 'D9920114', passport_expiry: iso(1400) })], '/crew');
// Her passport arrives: German, so there was never a permit to chase. One click
// on the crew row, and immigration settles back without the task being deleted.
await call('setSeatKit', [seat7, 'immigration', false], dawnPage);

// and one goes home
await call('releaseSeat', [one(`select a.id from assignments a join workers w on w.id=a.worker_id
  where a.project_id='${dawn}' and w.full_name='Anders Holm'`),
  fd({ reason: 'Family emergency — flew home on the 2nd', demobilize_on: iso(-2) })], dawnPage);

// the yard slips the window
await call('rescheduleProject', [dawn, fd({ start_date: iso(44), end_date: iso(66),
  reason: 'Yard slipped the docking window by six days' })], dawnPage);

console.log('PK-26001 travel  ', state(dawn, 'travel'),
            '· permits', state(dawn, 'immigration'),
            '· yard pass', state(dawn, 'yard_pass'));

/* ------------------------------------------------------------------------- */


/* =============================== 2 · PK-26002 · confirmed, waiting on a manager */
await call('createProject', [null, fd({
  name: 'Coral Sentinel — Singapore', client_name: 'Pacific Blue Lines', type: 'hull_job',
  location: 'Singapore', shipyard_name: 'Keppel Shipyard Tuas',
  est_start_date: iso(58), est_end_date: iso(80), team_size: '10',
  quote_value: '1240000', currency: 'USD',
  scope_note: 'Full blast and recoat, 6800 m². Ice-belt reinforcement coating, four coats above the waterline.',
})], '/projects/new');
const coral = P('PK-26002');
await call('confirmProject', [coral, fd({ start_date: iso(58), end_date: iso(80), team_size: '10' })], `/projects/${coral}`);
// the vessel gets named after the quote went out, and the scope is tightened
await call('updateProject', [coral, fd({
  name: 'Coral Sentinel — Singapore', client_name: 'Pacific Blue Lines',
  vessel_name: 'Coral Sentinel', imo: '9701255', type: 'hull_job',
  shipyard_name: 'Keppel Shipyard Tuas', location: 'Singapore',
  quote_value: '1240000', currency: 'USD',
  scope_note: 'Full blast and recoat, 6800 m². Ice-belt reinforcement coating, four coats above the waterline. Sea chests and gratings included following the class survey.',
})], `/projects/${coral}`);

/* ===================================== 3 · PK-26003 · still a quote, revised once */
await call('createProject', [null, fd({
  name: 'Northern Lyra — Gdańsk', client_name: 'Baltic Ore Carriers',
  vessel_name: 'Northern Lyra', type: 'repair',
  location: 'Gdańsk, Poland', shipyard_name: 'Remontowa',
  est_start_date: iso(72), est_end_date: iso(84), team_size: '4',
  quote_value: '190000', currency: 'EUR',
  scope_note: 'Ballast tank coating repair, two tanks. Supervision plus four.',
})], '/projects/new');
const lyra = P('PK-26003');
// the client comes back wanting more work, later, with more people — one revision
await call('rescheduleProject', [lyra, fd({
  start_date: iso(79), end_date: iso(95), team_size: '6',
  scope_note: 'Ballast tank coating repair, four tanks. Includes cargo hold touch-up, 900 m². Supervision plus six.',
  reason: 'Client added two tanks and the hold — pushed a week',
})], `/projects/${lyra}`);

/* ===================================================== 4 · PK-26004 · cancelled */
await call('createProject', [null, fd({
  name: 'Sea Harrier — Piraeus', client_name: 'Hellenic Coastal Shipping',
  vessel_name: 'Sea Harrier', type: 'supervision', location: 'Piraeus, Greece',
  est_start_date: iso(40), est_end_date: iso(48), team_size: '2',
  quote_value: '64000', currency: 'EUR',
  scope_note: 'Coating supervision only, two inspectors. No labour supplied.',
})], '/projects/new');
await call('cancelProject', [P('PK-26004'), fd({ reason: 'Client put the docking back to next year' })], '/quotation');

/* ============================ 5 · PK-26005 · running to the wire, kit outstanding */
await call('createProject', [null, fd({
  name: 'Andaman Pride — Dubai', client_name: 'Gulf Marine Services',
  vessel_name: 'Andaman Pride', imo: '9338217', type: 'hull_job',
  location: 'Dubai, UAE', shipyard_name: 'Drydocks World',
  est_start_date: iso(12), est_end_date: iso(34), team_size: '3',
  quote_value: '410000', currency: 'USD',
  scope_note: 'Boot-top and topsides recoat, 1900 m². Two coats, no blasting — sweep and patch only.',
})], '/projects/new');
const pride = P('PK-26005'), pridePage = `/projects/${pride}`;
await call('confirmProject', [pride, fd({ start_date: iso(12), end_date: iso(34), team_size: '3' })], pridePage);
await call('assignManager', [pride, rahul], pridePage);

// Dubai: everybody needs a permit, and Rahul runs it from here without going.
const prideCrew = [
  ['Suresh Nair', 'Painter', 'Indian', '+971 50 220 8891', 'M4410233', iso(890)],
  ['Ahmed Farouk', 'Blaster', 'Egyptian', '+20 100 442 1180', 'A2201947', iso(150)],
  ['Jose Ramos', 'Supervisor', 'Filipino', '+63 917 220 4411', 'P8830112', iso(1120)],
];
const ps = seats(pride);
for (let i = 0; i < prideCrew.length; i++)
  await call('fillSeat', [ps[i][0], fill({ worker_name: prideCrew[i][0], trade: prideCrew[i][1],
    mobilize_on: iso(10), needs_immigration: 'on' })], pridePage);
for (const [name, , nationality, phone, passport_no, passport_expiry] of prideCrew)
  await call('updateWorker', [one(`select id from workers where full_name='${name}'`),
    fd({ nationality, phone, passport_no, passport_expiry })], '/crew');

for (const [who] of prideCrew) {
  for (const t of ['Work permit / visa']) await call('setTaskStatus', [task(pride,'immigration',who,t), 'done'], pridePage);
  for (const t of ['Inbound flight','Outbound flight','Accommodation','Airport transfer'])
    await call('setTaskStatus', [task(pride,'travel',who,t), 'done'], pridePage);
  await call('setTaskStatus', [task(pride,'insurance',who,'Cover in place'), 'done'], pridePage);
  const pass = task(pride,'yard_pass',who,'Yard pass & induction');
  await call('setTaskStatus', [pass, 'done'], pridePage);
  await call('updateTask', [pass, fd({ valid_from: iso(8), valid_to: iso(40) })], pridePage);
}

const plog = sub(pride, 'logistics');
for (const t of [
  { title: '40 drums polysiloxane topcoat', qty_required: 40, qty_done: 40, due_date: iso(4) },
  { title: 'Blast grit — 8 tonnes', qty_required: 8, qty_done: 8, due_date: iso(4) },
  { title: 'Scaffolding — 400 m²', qty_required: 400, qty_done: 400, due_date: iso(6) },
  { title: 'Thinners — 12 drums', qty_required: 12, qty_done: 6, due_date: iso(9),
    note: 'Six landed. Balance held at customs on the paperwork — agent chasing.' },
  { title: 'Airless spray units — 3', qty_required: 3, qty_done: 0, due_date: iso(7), owner_party: 'client' },
]) await call('addTask', [plog, fd(t)], pridePage);
for (const [like, st] of [['40 drums%','done'],['Blast grit%','done'],['Scaffolding%','done'],
                          ['Thinners%','blocked'],['Airless%','awaiting_external']])
  await call('setTaskStatus', [kit(pride,'logistics',like), st], pridePage);

for (const r of rows(`select code, status, coalesce(manager_names,'—'), seats_filled||'/'||seats_total,
                             planning_done||'/'||planning_total, blocked_count, expiry_gap_count
                        from project_board order by code`))
  console.log('  ', r.join('  '));
