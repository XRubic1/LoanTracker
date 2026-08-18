/** Super Admin section ids (sidebar + dashboard content). */
export type SuperAdminTab =
  | 'dashboard'
  | 'clients'
  | 'insurance'
  | 'deductions'
  | 'companies'
  | 'activity'
  | 'groups'
  | 'superAdmins';

export const SUPER_ADMIN_BASE_TABS: { id: SuperAdminTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'insurance', label: 'Client Insurance' },
  { id: 'deductions', label: 'Deducted' },
  { id: 'companies', label: 'Companies' },
  { id: 'activity', label: 'Activity' },
  { id: 'groups', label: 'Client groups' },
  { id: 'superAdmins', label: 'Super admins' },
];

/** Tabs that fill the viewport (no page scroll). */
export const SUPER_ADMIN_FILL_TABS = new Set<SuperAdminTab>([
  'dashboard',
  'clients',
  'insurance',
  'deductions',
]);

/** Nav items shown in the main sidebar for platform admins. */
export function getSuperAdminNavTabs(): { id: SuperAdminTab; label: string }[] {
  return SUPER_ADMIN_BASE_TABS;
}
