import { useMemo, useState } from 'react';

import { Section } from '@/components/Section';

import { WorksheetClientAlerts } from '@/components/WorksheetClientAlerts';

import { WorksheetEntryForm } from '@/components/WorksheetEntryForm';

import { getWeekBoundsDateOnly } from '@/lib/utils';

import { isNewClientNeedsReview } from '@/lib/clientUtils';

import {
  findInsuranceForClient,
  getWorksheetClientAlerts,
  getWorksheetEntryDisplayName,
  hasWorksheetClientAlerts,
  isWorksheetUnknownClientEntry,
} from '@/lib/worksheetUtils';

import type { UseDataResult } from '@/hooks/useData';

import type { Client, ClientInsurance, WorksheetEntry } from '@/types';



interface WorksheetPageProps extends Pick<

  UseDataResult,

  'worksheetEntries' | 'clients' | 'clientInsurance' | 'addWorksheetEntry'

> {

  currentUserId: string;

  onEditEntry: (id: number) => void;

}



export function WorksheetPage({

  worksheetEntries,

  clients,

  clientInsurance,

  addWorksheetEntry,

  currentUserId,

  onEditEntry,

}: WorksheetPageProps) {

  const week = getWeekBoundsDateOnly();

  const [dateFrom, setDateFrom] = useState(week.start);

  const [dateTo, setDateTo] = useState(week.end);



  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);



  const myEntries = useMemo(

    () =>

      worksheetEntries

        .filter((e) => e.created_by === currentUserId)

        .filter((e) => e.work_date >= dateFrom && e.work_date <= dateTo)

        .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id),

    [worksheetEntries, currentUserId, dateFrom, dateTo]

  );



  return (

    <>

      <div className="flex flex-wrap gap-3 mb-4 items-end">

        <div>

          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</label>

          <input

            type="date"

            value={dateFrom}

            onChange={(e) => setDateFrom(e.target.value)}

            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"

          />

        </div>

        <div>

          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</label>

          <input

            type="date"

            value={dateTo}

            onChange={(e) => setDateTo(e.target.value)}

            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"

          />

        </div>

      </div>



      <WorksheetEntryForm

        clients={clients}

        clientInsurance={clientInsurance}

        variant="inline"

        submitLabel="Add"

        onSubmit={async (payload) => {

          if (!('id' in payload)) await addWorksheetEntry(payload);

        }}

      />



      <Section title={`${myEntries.length} batch${myEntries.length !== 1 ? 'es' : ''}`}>

        <WorksheetTable

          entries={myEntries}

          clientsById={clientsById}

          clientInsurance={clientInsurance}

          onEdit={onEditEntry}

        />

      </Section>

    </>

  );

}



function WorksheetTable({

  entries,

  clientsById,

  clientInsurance,

  onEdit,

}: {

  entries: WorksheetEntry[];

  clientsById: Map<number, Client>;

  clientInsurance: ClientInsurance[];

  onEdit: (id: number) => void;

}) {

  if (entries.length === 0) {

    return <p className="text-muted2 text-[13px] py-6 text-center">No batches in this date range.</p>;

  }



  return (

    <div className="overflow-x-auto -mx-1">

      <table className="data-table w-full min-w-[900px] [&_th]:text-center [&_td]:text-center">

        <thead>

          <tr>

            <th>Date</th>

            <th>Client</th>

            <th>Invoices</th>

            <th>Group</th>

            <th>Verified</th>

            <th>Expenses</th>

            <th className="min-w-[200px]">Alerts</th>

            <th>Note</th>

            <th></th>

          </tr>

        </thead>

        <tbody>

          {entries.map((e) => {

            const unknown = isWorksheetUnknownClientEntry(e);
            const client = e.client_id != null ? clientsById.get(e.client_id) : undefined;
            const displayName = getWorksheetEntryDisplayName(e, clientsById);
            const insurance = client ? findInsuranceForClient(client, clientInsurance) : null;
            const alerts = client ? getWorksheetClientAlerts(client, insurance) : null;
            const overdue = client && isNewClientNeedsReview(client);
            const highlight =
              unknown ||
              !e.verified ||
              overdue ||
              (alerts && hasWorksheetClientAlerts(alerts)) ||
              (alerts?.requiresFullVerification && !e.verified);

            return (
              <tr key={e.id} className={highlight ? 'bg-accent/5' : undefined}>
                <td>{e.work_date}</td>
                <td className="font-medium text-ink">
                  {displayName}
                  {unknown && (
                    <span className="block text-[10px] font-normal text-accent mt-0.5">
                      Not on client list
                    </span>
                  )}
                </td>

                <td>{e.invoice_count}</td>

                <td>{e.group_work ? 'YES' : 'NO'}</td>

                <td

                  className={

                    e.verified

                      ? 'text-green'

                      : alerts?.requiresFullVerification

                        ? 'text-red font-semibold'

                        : 'text-accent'

                  }

                >

                  {e.verified ? 'YES' : 'NO'}

                </td>

                <td className="text-muted2">{client?.expenses ?? '—'}</td>

                <td className="align-middle py-2 max-w-[280px]">

                  {client && alerts && hasWorksheetClientAlerts(alerts) ? (

                    <WorksheetClientAlerts

                      client={client}

                      insurance={insurance}

                      variant="compact"

                      alerts={alerts}

                    />

                  ) : (

                    <span className="text-muted2 text-[12px]">—</span>

                  )}

                </td>

                <td className="text-[12px] max-w-[120px] text-muted2">{e.note || '—'}</td>

                <td>

                  <button type="button" onClick={() => onEdit(e.id)} className="text-xs text-muted2 hover:text-accent">

                    Edit

                  </button>

                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

    </div>

  );

}

