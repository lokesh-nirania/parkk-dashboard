import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui';

/**
 * A deliberately honest placeholder. The lifecycle stage exists in the design
 * and in the nav, so the shape of the product is visible — but the page says
 * plainly that it is not built, rather than showing mock data that implies it is.
 */
export function StageStub({
  title, oneLine, willTrack, why, dependsOn,
}: {
  title: string;
  oneLine: string;
  willTrack: string[];
  why: string;
  dependsOn?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={oneLine}
        right={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
            <span className="size-[5px] rounded-full border" style={{ borderColor: 'var(--border-strong)' }} />
            Not built
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-[13px] font-semibold text-ink">What will live here</h2>
          <ul className="mt-3 space-y-2">
            {willTrack.map((t) => (
              <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: 'var(--border-strong)' }} />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-[13px] font-semibold text-ink">Why it is out of this cut</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{why}</p>
          </Card>
          {dependsOn && (
            <Card>
              <h2 className="text-[13px] font-semibold text-ink">Blocked on an answer</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{dependsOn}</p>
            </Card>
          )}
        </div>
      </div>

      <p className="text-[12px] text-faint">
        Scope and sequencing live in{' '}
        <span className="font-mono">implementation/04-roadmap.md</span>. The one screen this
        cut is really about is the{' '}
        <Link href="/board" className="underline underline-offset-2 hover:text-muted">readiness board</Link>.
      </p>
    </div>
  );
}
