import { StageStub } from '@/components/stage-stub';

export default function Page() {
  return (
    <StageStub
      title="Execution"
      oneLine="Once the crew is at the yard, readiness stops being the question and daily obligations start."
      willTrack={[
        'Daily reports — area blasted, area coated, coats applied, hours worked',
        'Obligations grid: the recurring things owed each day, as standing obligations rather than tasks anyone ticks off',
        'Hold points and inspection sign-offs against the coating spec',
        'Progress against the technical scope, so percent complete is derived from area and coats, not typed in by hand',
      ]}
      why="The POC answers one question — what is not ready before a start date. Execution is a different
           question with a different rhythm, and building it now would dilute the demo."
      dependsOn="What does the site actually report today, and to whom? If it is a WhatsApp photo at 6pm,
                 the first version of this is an inbox, not a form."
    />
  );
}
