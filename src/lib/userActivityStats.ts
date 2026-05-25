import {
  analyzeWorkDurationBetweenBatches,
  getWorksheetEntryDisplayName,
  getWorksheetAuthorLabel,
  isWorksheetUnknownClientEntry,
} from '@/lib/worksheetUtils';
import { daysInRangeInclusive, isWeekdayDateOnly } from '@/lib/utils';
import type { Client, TeamMember, WorksheetEntry } from '@/types';

/** Max weekday columns in the daily log grid. */
const MAX_DAILY_GRID_WEEKDAYS = 15;

export interface UserActivitySummary {
  totalBatches: number;
  totalInvoices: number;
  activeUsers: number;
  unverifiedCount: number;
  verifiedCount: number;
  groupWorkCount: number;
  unknownClientCount: number;
  /** Unverified batches + unknown-client batches (owner action queue size). */
  attentionCount: number;
  timingReviewCount: number;
  timingSlowCount: number;
  timingFastCount: number;
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

export type TeamCoverageStatus = 'active' | 'inactive' | 'pending';

export interface TeamCoverageRow {
  userId: string | null;
  label: string;
  email: string;
  status: TeamCoverageStatus;
  batches: number;
  invoices: number;
  lastActiveDate: string | null;
}

export interface DailyActivityCell {
  date: string;
  batches: number;
  invoices: number;
}

export interface DailyActivityRow {
  userId: string;
  label: string;
  days: DailyActivityCell[];
}

export interface UserActivityAnalytics {
  summary: UserActivitySummary;
  byUser: UserActivityByUser[];
  byClient: UserActivityByClient[];
  byDate: UserActivityByDate[];
  teamCoverage: TeamCoverageRow[];
  dailyGrid: DailyActivityRow[];
  avgBatchesPerDay: number;
  daysWithAnyActivity: number;
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

  const daysWithAnyActivity = byDate.filter((d) => d.batches > 0).length;
  const rangeDays = daysInRangeInclusive(dateFrom, dateTo);
  const avgBatchesPerDay =
    rangeDays > 0 ? Math.round((entries.length / rangeDays) * 10) / 10 : 0;

  const gridDates = byDate
    .filter((d) => isWeekdayDateOnly(d.date))
    .slice(0, MAX_DAILY_GRID_WEEKDAYS);
  const teamCoverage = buildTeamCoverage(entries, userMap, ownerId, teamMembers);
  const dailyGrid = buildDailyGrid(entries, byUser, gridDates);

  const durationFindings = analyzeWorkDurationBetweenBatches(entries);
  let timingSlowCount = 0;
  let timingFastCount = 0;
  for (const f of durationFindings.values()) {
    if (f.review === 'slow') timingSlowCount++;
    else timingFastCount++;
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
      attentionCount: unverifiedCount + unknownClientCount + durationFindings.size,
      timingReviewCount: durationFindings.size,
      timingSlowCount,
      timingFastCount,
    },
    byUser,
    byClient,
    byDate,
    teamCoverage,
    dailyGrid,
    avgBatchesPerDay,
    daysWithAnyActivity,
  };
}

function buildTeamCoverage(
  entries: WorksheetEntry[],
  userMap: Map<string, UserActivityByUser>,
  ownerId: string,
  teamMembers: TeamMember[]
): TeamCoverageRow[] {
  const lastDateByUser = new Map<string, string>();
  for (const e of entries) {
    const prev = lastDateByUser.get(e.created_by);
    if (!prev || e.work_date > prev) lastDateByUser.set(e.created_by, e.work_date);
  }

  const rows: TeamCoverageRow[] = [];

  const ownerRow = userMap.get(ownerId);
  rows.push({
    userId: ownerId,
    label: getWorksheetAuthorLabel(ownerId, ownerId, teamMembers),
    email: '',
    status: ownerRow && ownerRow.batches > 0 ? 'active' : 'inactive',
    batches: ownerRow?.batches ?? 0,
    invoices: ownerRow?.invoices ?? 0,
    lastActiveDate: lastDateByUser.get(ownerId) ?? null,
  });

  for (const m of teamMembers) {
    if (!m.member_id) {
      rows.push({
        userId: null,
        label: m.email,
        email: m.email,
        status: 'pending',
        batches: 0,
        invoices: 0,
        lastActiveDate: null,
      });
      continue;
    }
    const u = userMap.get(m.member_id);
    const batches = u?.batches ?? 0;
    rows.push({
      userId: m.member_id,
      label: getWorksheetAuthorLabel(m.member_id, ownerId, teamMembers),
      email: m.email,
      status: batches > 0 ? 'active' : 'inactive',
      batches,
      invoices: u?.invoices ?? 0,
      lastActiveDate: lastDateByUser.get(m.member_id) ?? null,
    });
  }

  const seen = new Set(rows.map((r) => r.userId).filter(Boolean));
  for (const u of userMap.values()) {
    if (seen.has(u.userId) || u.userId === ownerId) continue;
    rows.push({
      userId: u.userId,
      label: u.label,
      email: '',
      status: 'active',
      batches: u.batches,
      invoices: u.invoices,
      lastActiveDate: lastDateByUser.get(u.userId) ?? null,
    });
  }

  return rows.sort((a, b) => {
    const order = { active: 0, inactive: 1, pending: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return b.batches - a.batches;
  });
}

function buildDailyGrid(
  entries: WorksheetEntry[],
  byUser: UserActivityByUser[],
  dates: UserActivityByDate[]
): DailyActivityRow[] {
  if (dates.length === 0 || byUser.length === 0) return [];
  const dateList = dates.map((d) => d.date);
  return byUser.map((u) => {
    const batchCounts = new Map<string, number>();
    const invoiceCounts = new Map<string, number>();
    for (const e of entries) {
      if (e.created_by !== u.userId) continue;
      batchCounts.set(e.work_date, (batchCounts.get(e.work_date) ?? 0) + 1);
      invoiceCounts.set(e.work_date, (invoiceCounts.get(e.work_date) ?? 0) + e.invoice_count);
    }
    return {
      userId: u.userId,
      label: u.label,
      days: dateList.map((date) => ({
        date,
        batches: batchCounts.get(date) ?? 0,
        invoices: invoiceCounts.get(date) ?? 0,
      })),
    };
  });
}
