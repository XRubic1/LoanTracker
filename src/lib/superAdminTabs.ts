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
];

export const SUPER_ADMIN_DEV_TAB: { id: SuperAdminTab; label: string } = {
  id: 'superAdmins',
  label: 'Super admins',
};

/** Tabs that fill the viewport (no page scroll). */
export const SUPER_ADMIN_FILL_TABS = new Set<SuperAdminTab>([
  'dashboard',
  'clients',
  'insurance',
  'deductions',
]);

/** Nav items shown in the main sidebar for platform admins. */
export function getSuperAdminNavTabs(): { id: SuperAdminTab; label: string }[] {
  const isDev = import.meta.env.DEV;
  return isDev ? [...SUPER_ADMIN_BASE_TABS, SUPER_ADMIN_DEV_TAB] : SUPER_ADMIN_BASE_TABS;
}
