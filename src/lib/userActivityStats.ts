import {
  getWorksheetEntryDisplayName,
  getWorksheetAuthorLabel,
  isWorksheetUnknownClientEntry,
} from '@/lib/worksheetUtils';
import type { Client, TeamMember, WorksheetEntry } from '@/types';

export interface UserActivitySummary {
  totalBatches: number;
  totalInvoices: number;
  activeUsers: number;
  unverifiedCount: number;
  verifiedCount: number;
  groupWorkCount: number;
  unknownClientCount: number;
}

export interface UserActivityByUser {
  userId: string;
  label: string;
  batches: number;
  invoices: number;
  unverified: number;
  verified: number;
  groupWork: number;
  topClients: { name: string; batches: number }[];
}

export interface UserActivityByClient {
  name: string;
  batches: number;
  invoices: number;
  userLabels: string[];
}

export interface UserActivityByDate {
  date: string;
  batches: number;
  invoices: number;
}

export interface UserActivityAnalytics {
  summary: UserActivitySummary;
  byUser: UserActivityByUser[];
  byClient: UserActivityByClient[];
  byDate: UserActivityByDate[];
}

const TOP_CLIENTS_PER_USER = 3;
const TOP_CLIENTS_CHART = 10;

/** Aggregate worksheet entries for dashboards and charts. */
export function buildUserActivityAnalytics(
  entries: WorksheetEntry[],
  clientsById: Map<number, Client>,
  ownerId: string,
  teamMembers: TeamMember[],
  dateFrom: string,
  dateTo: string
): UserActivityAnalytics {
  const userMap = new Map<string, UserActivityByUser>();
  const clientMap = new Map<string, { batches: number; invoices: number; users: Set<string> }>();
  const dateMap = new Map<string, { batches: number; invoices: number }>();

  let unverifiedCount = 0;
  let verifiedCount = 0;
  let groupWorkCount = 0;
  let unknownClientCount = 0;
  let totalInvoices = 0;

  for (const e of entries) {
    totalInvoices += e.invoice_count;
    if (e.verified) verifiedCount++;
    else unverifiedCount++;
    if (e.group_work) groupWorkCount++;
    if (isWorksheetUnknownClientEntry(e)) unknownClientCount++;

    const userId = e.created_by;
    const label = getWorksheetAuthorLabel(userId, ownerId, teamMembers);
    let userRow = userMap.get(userId);
    if (!userRow) {
      userRow = {
        userId,
        label,
        batches: 0,
        invoices: 0,
        unverified: 0,
        verified: 0,
        groupWork: 0,
        topClients: [],
      };
      userMap.set(userId, userRow);
    }
    userRow.batches += 1;
    userRow.invoices += e.invoice_count;
    if (e.verified) userRow.verified += 1;
    else userRow.unverified += 1;
    if (e.group_work) userRow.groupWork += 1;

    const clientName = getWorksheetEntryDisplayName(e, clientsById);
    const clientRow = clientMap.get(clientName) ?? {
      batches: 0,
      invoices: 0,
      users: new Set<string>(),
    };
    clientRow.batches += 1;
    clientRow.invoices += e.invoice_count;
    clientRow.users.add(label);
    clientMap.set(clientName, clientRow);

    const dateRow = dateMap.get(e.work_date) ?? { batches: 0, invoices: 0 };
    dateRow.batches += 1;
    dateRow.invoices += e.invoice_count;
    dateMap.set(e.work_date, dateRow);
  }

  const byUser = Array.from(userMap.values())
    .map((u) => {
      const clientCounts = new Map<string, number>();
      for (const e of entries.filter((x) => x.created_by === u.userId)) {
        const name = getWorksheetEntryDisplayName(e, clientsById);
        clientCounts.set(name, (clientCounts.get(name) ?? 0) + 1);
      }
      const topClients = Array.from(clientCounts.entries())
        .map(([name, batches]) => ({ name, batches }))
        .sort((a, b) => b.batches - a.batches)
        .slice(0, TOP_CLIENTS_PER_USER);
      return { ...u, topClients };
    })
    .sort((a, b) => b.batches - a.batches);

  const byClient = Array.from(clientMap.entries())
    .map(([name, row]) => ({
      name,
      batches: row.batches,
      invoices: row.invoices,
      userLabels: Array.from(row.users),
    }))
    .sort((a, b) => b.batches - a.batches)
    .slice(0, TOP_CLIENTS_CHART);

  const byDate: UserActivityByDate[] = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = cursor.toISOString().split('T')[0];
      const row = dateMap.get(iso);
      byDate.push({
        date: iso,
        batches: row?.batches ?? 0,
        invoices: row?.invoices ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    byDate.push(
      ...Array.from(dateMap.entries())
        .map(([date, row]) => ({ date, batches: row.batches, invoices: row.invoices }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  }

  return {
    summary: {
      totalBatches: entries.length,
      totalInvoices,
      activeUsers: userMap.size,
      unverifiedCount,
      verifiedCount,
      groupWorkCount,
      unknownClientCount,
    },
    byUser,
    byClient,
    byDate,
  };
}
