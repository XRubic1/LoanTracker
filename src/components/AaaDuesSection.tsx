import { useState } from 'react';
import type { AaaDue, AaaPayee, ClientInsurance } from '@/types';
import { Badge } from '@/components/Badge';
import { AddAaaDueModal } from '@/components/modals/AddAaaDueModal';
import { AaaDueModal } from '@/components/modals/AaaDueModal';
import {
  aaaDuePaid,
  aaaDueRemaining,
  aaaDueStatus,
  weekLabel,
} from '@/lib/aaaDues';
import { fmt } from '@/lib/utils';

interface AaaDuesSectionProps {
  dues: AaaDue[];
  clientInsurance: ClientInsurance[];
  onAdd: (payload: { client: string; payee: AaaPayee; amount: number; weekStart: string }) => Promise<unknown>;
  onPostDeduction: (due: AaaDue, deduction: { amount: number; date: string; note?: string }) => Promise<{ closed: boolean }>;
  onDelete?: (id: number) => Promise<void>;
}

/** Dashboard table of weekly AAA payments that are owed, with add / partial-payment actions. */
export function AaaDuesSection({ dues, clientInsurance, onAdd, onPostDeduction, onDelete }: AaaDuesSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const selected = openId != null ? dues.find((d) => d.id === openId) ?? null : null;

  const pastDueCount = dues.filter((d) => aaaDueStatus(d) === 'past_due').length;
  const totalLeft = dues.reduce((sum, d) => sum + aaaDueRemaining(d), 0);

  return (
    <>
      <div className="panel-surface" data-tour="aaa-dues">
        <div className="flex items-center justify-between gap-3 px-4 py-[11px] border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">AAA Payments Due</span>
            <span className="count-badge">{dues.length}</span>
            {dues.length > 0 && (
              <span className="text-[11px] text-muted truncate">
                {fmt(totalLeft)} left{pastDueCount > 0 ? ` · ${pastDueCount} past due` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-primary h-7 px-3 text-[11px] whitespace-nowrap flex-shrink-0"
          >
            + Add payment
          </button>
        </div>

        <table className="w-full border-collapse table-fixed" data-default-sort="3:asc">
          <colgroup>
            <col style={{ width: '23%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '19%' }} />
          </colgroup>
          <thead>
            <tr>
              {['Company', 'Payee', 'Week', 'Amount', 'Status'].map((h) => (
                <th
                  key={h}
                  className="text-[10px] text-label font-normal uppercase tracking-[0.05em] px-4 py-2 text-left border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted text-[12px]">
                  No AAA payments due. Use “Add payment” to add one for a week.
                </td>
              </tr>
            ) : (
              dues.map((d) => {
                const status = aaaDueStatus(d);
                const paid = aaaDuePaid(d);
                const left = aaaDueRemaining(d);
                return (
                  <tr
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(d.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpenId(d.id)}
                    className="row-hover transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-[11px] border-b border-border align-middle overflow-hidden">
                      <div className="font-medium text-[12px] text-ink truncate">{d.client}</div>
                      {d.source === 'fuel' && (
                        <div className="text-[10px] text-accent">Added by AAA Fuel</div>
                      )}
                    </td>
                    <td className="px-4 py-[11px] border-b border-border align-middle overflow-hidden">
                      <span className="text-[11px] text-muted2 truncate block">{d.payee}</span>
                    </td>
                    <td className="px-4 py-[11px] border-b border-border align-middle">
                      <span className="text-[11px] text-muted2 whitespace-nowrap">{weekLabel(d.weekStart)}</span>
                    </td>
                    <td className="px-4 py-[11px] border-b border-border align-middle">
                      {paid > 0 ? (
                        <div className="max-w-[210px]">
                          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                            <span className="text-[13px] font-semibold text-yellow">{fmt(left)}</span>
                            <span className="text-[10px] text-muted">left</span>
                          </div>
                          <div className="mt-1.5 h-[4px] bg-border overflow-hidden">
                            <div
                              className="h-full bg-green"
                              style={{ width: `${Math.min(100, (paid / d.amount) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between gap-3 whitespace-nowrap text-[10px] text-muted">
                            <span className="text-green">{fmt(paid)} paid</span>
                            <span>of {fmt(d.amount)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[13px] font-medium text-yellow">{fmt(d.amount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-[11px] border-b border-border align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {status === 'past_due' ? (
                          <Badge variant="overdue">Past due</Badge>
                        ) : status === 'upcoming' ? (
                          <Badge variant="closed">Upcoming</Badge>
                        ) : (
                          <Badge variant="due">Due</Badge>
                        )}
                        {paid > 0 && <Badge variant="ok">Partial</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddAaaDueModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clientInsurance={clientInsurance}
        onAdd={async (payload) => {
          await onAdd(payload);
        }}
      />
      <AaaDueModal
        due={selected}
        open={selected != null}
        onClose={() => setOpenId(null)}
        onPost={onPostDeduction}
        onDelete={onDelete}
      />
    </>
  );
}
