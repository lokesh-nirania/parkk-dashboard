/* ============================================================================
 * The vocabulary. Mirrors the enums in the migration — if you change one, change
 * the other.
 *
 *   Quote → Confirmation → Planning → Execution → Invoicing
 *
 * Planning is the stage with depth: it holds substages that all run at once,
 * and each substage holds tasks. Substages are rows in the database rather than
 * a type in this file, so the six below are the ones a project opens with, not
 * the only ones it can have.
 * ========================================================================== */

export const ITEM_STATUSES = [
  'n_a', 'not_started', 'in_progress', 'awaiting_external', 'blocked', 'done',
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type OwnerParty = 'us' | 'client' | 'agency';
export type ProjectType = 'hull_job' | 'supervision' | 'repair';
export type PersonRole = 'admin' | 'manager';
export type SubstageUnit = 'tasks' | 'seats';

export const PROJECT_STATUSES = [
  'quoted', 'confirmed', 'planning', 'in_progress',
  'invoicing', 'completed', 'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STAGES = [
  'quote', 'confirmation', 'planning', 'execution', 'invoicing',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** The substages a planning stage opens with. A project can carry others. */
export const SUBSTAGE_KEYS = [
  'manpower', 'immigration', 'travel', 'yard_pass', 'insurance', 'logistics',
] as const;
export type SubstageKey = (typeof SUBSTAGE_KEYS)[number];

/**
 * The workstreams that write a task per person when a seat is filled, and
 * whether a seat can be excused one.
 *
 * Travel is the reason this distinction exists. Anybody who goes to the yard
 * needs a flight out, a bed, a way to the dock, a flight home, cover and a pass
 * through the gate — there is no such thing as a seat that travels without them,
 * so there is nothing to ask. A permit is the opposite: half a local crew needs
 * none, and which half is a fact about this job, not about the person.
 *
 * Mirrors substage_templates.person_tasks / person_optional in the migration.
 */
export const PERSON_KITS: Record<string, { label: string; optional: boolean; tasks: number }> = {
  immigration: { label: 'Work permit', optional: true,  tasks: 1 },
  travel:      { label: 'Travel',      optional: false, tasks: 4 },
  yard_pass:   { label: 'Yard pass',   optional: false, tasks: 1 },
  insurance:   { label: 'Insurance',   optional: false, tasks: 1 },
};

/** The kits a seat may be excused, in the order they are shown. */
export const OPTIONAL_KITS = Object.entries(PERSON_KITS)
  .filter(([, k]) => k.optional)
  .map(([key, k]) => ({ key, label: k.label }));

/* ------------------------------------------------------------------- labels */

export const STATUS_LABEL: Record<ItemStatus, string> = {
  n_a: 'n/a',
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_external: 'Awaiting external',
  blocked: 'Blocked',
  done: 'Done',
};

// The distinction the product is built on: "we haven't filed it" and "we filed
// it five weeks ago and nobody has replied" are different phone calls.
export const STATUS_HINT: Record<ItemStatus, string> = {
  n_a: 'Not applicable to this scope',
  not_started: 'Nobody has begun this',
  in_progress: 'We are working it',
  awaiting_external: 'Filed — waiting on someone outside',
  blocked: 'Stopped. Needs a decision or an escalation',
  done: 'Complete',
};

export const OWNER_LABEL: Record<OwnerParty, string> = {
  us: 'Parkk',
  client: 'Client',
  agency: 'Agency',
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  hull_job: 'Hull job',
  supervision: 'Supervision',
  repair: 'Repair',
};

export const ROLE_LABEL: Record<PersonRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  planning: 'Planning',
  in_progress: 'In progress',
  invoicing: 'Invoicing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STAGE_LABEL: Record<ProjectStage, string> = {
  quote: 'Quote',
  confirmation: 'Confirmation',
  planning: 'Planning',
  execution: 'Execution',
  invoicing: 'Invoicing',
};

/** Short column headings for the board, where six of these sit side by side. */
export const SUBSTAGE_LABEL: Record<SubstageKey, string> = {
  manpower: 'Manpower',
  immigration: 'Immigration',
  travel: 'Travel',
  yard_pass: 'Yard pass',
  insurance: 'Insurance',
  logistics: 'Logistics',
};

/* ------------------------------------------------------------- the lifecycle */

/**
 * What a project is waiting for. Renders as "Confirmed · pending a manager" —
 * the stage it is in, and the thing that has not happened yet.
 */
export const PENDING_LABEL: Record<ProjectStatus, string | null> = {
  quoted: 'confirmation',
  confirmed: 'a manager',
  planning: 'commencement',
  in_progress: 'invoicing',
  invoicing: 'closeout',
  completed: null,
  cancelled: null,
};

/**
 * The gate out of each status: what it is called, where it goes, and the
 * precondition in words somebody can act on. A project moves forward one gate
 * at a time — there is no free status dropdown anywhere in the app.
 */
export type Gate = {
  next: ProjectStatus;
  label: string;
  requires: string;
};

export const GATE: Record<ProjectStatus, Gate | null> = {
  quoted: {
    next: 'confirmed',
    label: 'Confirm',
    requires: 'The agreed dates and crew size. The estimate on the quote is only a proposal until this.',
  },
  confirmed: {
    next: 'planning',
    label: 'Assign a manager',
    requires: 'A manager. Naming one is what opens planning — the six workstreams and a seat per person.',
  },
  planning: {
    next: 'in_progress',
    label: 'Commence',
    requires: 'Every planning substage done or marked n/a.',
  },
  in_progress: { next: 'invoicing', label: 'Move to invoicing', requires: 'Not built in this cut.' },
  invoicing: { next: 'completed', label: 'Close out', requires: 'Not built in this cut.' },
  completed: null,
  cancelled: null,
};

/** Which stage a status sits in, for the stage rail. */
export const STAGE_OF_STATUS: Record<ProjectStatus, ProjectStage> = {
  quoted: 'quote',
  confirmed: 'confirmation',
  planning: 'planning',
  in_progress: 'execution',
  invoicing: 'invoicing',
  completed: 'invoicing',
  cancelled: 'quote',
};

export const STAGE_INDEX: Record<ProjectStatus, number> = {
  quoted: 0, confirmed: 1, planning: 2, in_progress: 3, invoicing: 4,
  completed: 5, cancelled: 0,
};

export const STATUS_SEVERITY: Record<ItemStatus, number> = {
  blocked: 5, not_started: 4, awaiting_external: 3, in_progress: 2, done: 1, n_a: 0,
};

// A project that stopped. Cancelled covers every reason a job does not happen —
// the quote goes quiet, the client reorganises, the yard slot vanishes — because
// the system never actually learns which of those it was.
export const TERMINAL: ProjectStatus[] = ['completed', 'cancelled'];

/* -------------------------------------------------------------------- rows */

/** Parkk staff. An admin signs in; a manager is assignable and will sign in later. */
export type Person = {
  id: string;
  user_id: string | null;
  role: PersonRole;
  full_name: string;
  short_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
};

export type BoardRow = {
  id: string;
  code: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;

  /* The three date pairs. start_date/end_date are the live ones — every clock
     in the app reads those. */
  est_start_date: string | null;
  est_end_date: string | null;
  confirmed_start_date: string | null;
  confirmed_end_date: string | null;
  start_date: string | null;
  end_date: string | null;

  team_size: number | null;
  location: string | null;
  scope_note: string | null;
  quote_value: number | null;
  currency: string | null;
  confirmed_at: string | null;
  planning_started_at: string | null;
  commenced_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by_name: string | null;
  confirmed_by_name: string | null;
  client_name: string | null;
  vessel_name: string | null;
  shipyard_name: string | null;
  shipyard_city: string | null;
  shipyard_country: string | null;

  days_to_start: number | null;
  /** Confirmed start minus quoted start. How far the quote was out. */
  quote_shift_days: number | null;
  /** Live start minus confirmed start. The slip. */
  schedule_shift_days: number | null;
  reschedule_count: number;

  manager_names: string | null;
  manager_count: number;

  /** Seats currently on the job. Released ones are counted separately. */
  seats_total: number;
  seats_filled: number;
  seats_released: number;
  /** How many of the live seats are our own managers going out. */
  seats_manager: number;

  planning_total: number;
  planning_done: number;
  blocked_count: number;
  expiry_gap_count: number;
  overdue_count: number;
  open_task_count: number;
};

/** A planning workstream, with what is beneath it already counted. */
export type Substage = {
  id: string;
  project_id: string;
  template_key: SubstageKey | null;
  stage: ProjectStage;
  seq: number;
  title: string;
  help: string | null;
  unit: SubstageUnit;
  /** Only consulted while nothing is beneath it. */
  status: ItemStatus;
  owner_person_id: string | null;
  owner_short: string | null;
  owner_name: string | null;
  note: string | null;
  updated_at: string;
  total: number;
  done: number;
  blocked: number;
  awaiting: number;
  expiry_gaps: number;
  overdue: number;
  qty_required: number;
  qty_done: number;
  /**
   * True once something is beneath it. Its status is then computed from what is
   * there and cannot be set by hand — nobody ticks travel green while a flight
   * is unbooked.
   */
  is_derived: boolean;
  effective_status: ItemStatus;
};

export type Task = {
  id: string;
  project_id: string;
  substage_id: string;
  assignment_id: string | null;
  title: string;
  subject_label: string | null;
  status: ItemStatus;
  owner_party: OwnerParty;
  owner_person_id: string | null;
  due_date: string | null;
  valid_from: string | null;
  valid_to: string | null;
  qty_required: number | null;
  qty_done: number | null;
  note: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  /* from the view */
  project_code: string;
  project_name: string;
  project_end_date: string | null;
  substage_title: string;
  substage_key: SubstageKey | null;
  occupant_name: string | null;
  occupant_kind: OccupantKind | null;
  seat_no: number | null;
  seat_released_at: string | null;
  subject: string | null;
  owner_short: string | null;
  /** False when the person it belongs to has come off the job. */
  is_live: boolean;
  has_expiry_gap: boolean;
  is_overdue: boolean;
  severity: number;
};

/**
 * Who is in a seat. Never deleted — released is a date, not a disappearance.
 *
 * A manager who flies out and runs the job from the dock is manpower like
 * anybody else — same permit, same bed, same yard pass — so a seat holds
 * either kind and everything downstream reads one name.
 */
export type OccupantKind = 'worker' | 'manager';

export type Seat = {
  id: string;
  project_id: string;
  seat_no: number;
  worker_id: string | null;
  person_id: string | null;
  trade: string;
  /** Template keys this seat does not need. Read through OPTIONAL_KITS. */
  waived_substages: string[];
  mobilize_on: string | null;
  demobilize_on: string | null;
  filled_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
  /* from seats_effective */
  occupant_kind: OccupantKind | null;
  occupant_id: string | null;
  occupant_name: string | null;
  occupant_short: string | null;
  is_filled: boolean;
  is_live: boolean;
};

export type Worker = {
  id: string;
  full_name: string;
  nationality: string | null;
  trade: string;
  passport_no: string | null;
  passport_expiry: string | null;
  phone: string | null;
};

export type ProjectManager = {
  project_id: string;
  person_id: string;
  assigned_at: string;
  removed_at: string | null;
};

export type NamedRef = { id: string; name: string };

/* ---------------------------------------------------------------- schedule */

export const DATE_FIELDS = [
  'est_start_date', 'est_end_date',
  'confirmed_start_date', 'confirmed_end_date',
  'start_date', 'end_date',
] as const;
export type DateField = (typeof DATE_FIELDS)[number];

export const DATE_FIELD_LABEL: Record<DateField, string> = {
  est_start_date: 'Estimated start',
  est_end_date: 'Estimated end',
  confirmed_start_date: 'Confirmed start',
  confirmed_end_date: 'Confirmed end',
  start_date: 'Start',
  end_date: 'End',
};

/** One date moving, once. Read from project_schedule_events. */
export type ScheduleEvent = {
  id: number;
  project_id: string;
  created_at: string;
  actor: string | null;
  action: string;
  field: DateField;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  detail: string | null;
  /** new − old, in days. Null on the first setting of a date. */
  shift_days: number | null;
};

/** How long a project spent in each stage. Derived from the trail. */
export type StagePeriod = {
  project_id: string;
  status: ProjectStatus;
  entered_at: string;
  left_at: string | null;
  days: number;
};

/* ------------------------------------------------------------------- trail */

export type ChangeEvent = {
  id: number;
  project_id: string | null;
  entity: string | null;
  item_id: string | null;
  actor: string | null;
  action: string;
  detail: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
};

/** Verbs, for the feed. Anything unlisted falls back to the raw slug. */
export const ACTION_LABEL: Record<string, string> = {
  project_created: 'quote raised',
  dates_estimated: 'dates estimated',
  estimate_revised: 'estimate revised',
  project_confirmed: 'confirmed',
  dates_confirmed: 'dates confirmed',
  dates_shifted: 'dates shifted',
  team_size_changed: 'crew size changed',
  project_updated: 'details edited',
  project_cancelled: 'cancelled',
  manager_assigned: 'manager assigned',
  manager_removed: 'manager removed',
  planning_opened: 'planning opened',
  project_commenced: 'commenced',
  substage_added: 'workstream added',
  substage_status_changed: 'workstream status',
  substage_owner_changed: 'workstream owner',
  substage_completed: 'workstream complete',
  substage_reopened: 'workstream reopened',
  task_added: 'task added',
  task_status_changed: 'task status',
  task_updated: 'task edited',
  seat_added: 'seat added',
  seat_filled: 'crew on',
  seat_released: 'crew off',
  seat_kit_changed: 'obligations changed',
  worker_added: 'crew added',
  worker_updated: 'crew record',
  person_added: 'person added',
  person_deactivated: 'person deactivated',
  project_deleted: 'deleted',
};
