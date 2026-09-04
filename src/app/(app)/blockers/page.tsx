import { StageStub } from '@/components/stage-stub';

export default function Page() {
  return (
    <StageStub
      title="Blockers & variations"
      oneLine="What stopped, who owns it, what it cost — and the extra work that loops back into planning."
      willTrack={[
        'Blockers raised against a project or a single item, with owner and age',
        'Variations: extra scope agreed mid-job, priced, and fed back into the plan',
        'A variation that adds people re-opens planning — readiness goes live again in week three',
        'Time and cost impact per blocker, which is what turns a complaint into a claim',
      ]}
      why="readiness_items already carries a blocked status, which is enough to show the concept — see the
           thinner cans stuck in Dubai customs on PK-2398. A full blocker record with cost impact is a
           bigger object and belongs after the core is confirmed."
      dependsOn="When extra people get added in week three, does planning genuinely re-open? We have assumed
                 yes, which is what keeps readiness live for a whole project rather than only before start."
    />
  );
}
