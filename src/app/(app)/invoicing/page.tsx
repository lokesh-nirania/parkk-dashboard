import { StageStub } from '@/components/stage-stub';

export default function Page() {
  return (
    <StageStub
      title="Invoicing"
      oneLine="Quote in, invoices out — milestones, variations and what is still unpaid."
      willTrack={[
        'Invoice schedule against project milestones, and what each one is contingent on',
        'Variations flowing through to invoice lines rather than being remembered at the end',
        'Sent / due / paid / overdue, with age',
        'Reconciliation back to the original quote, so scope drift is visible in money',
      ]}
      why="Cost tracking and invoicing are explicitly out of the POC. Projects carry a quote value so the
           number exists on the record, but nothing is derived from it yet."
      dependsOn="Is invoicing already in an accounting package? If so this screen is a read-only mirror and
                 an export, not a second system that has to be kept in step."
    />
  );
}
