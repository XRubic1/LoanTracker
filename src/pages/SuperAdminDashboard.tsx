import { CompaniesTab } from '@/components/superAdmin/CompaniesTab';
import { AllLoansTab } from '@/components/superAdmin/AllLoansTab';
import { AllActivityTab } from '@/components/superAdmin/AllActivityTab';
import { CompanyGroupsTab } from '@/components/superAdmin/CompanyGroupsTab';
import { ClientInsuranceTab } from '@/components/superAdmin/ClientInsuranceTab';
import { DeductedInstallmentsTab } from '@/components/superAdmin/DeductedInstallmentsTab';
import { AdminClientsTab } from '@/components/superAdmin/AdminClientsTab';
import { PlatformAdminsTab } from '@/components/superAdmin/PlatformAdminsTab';
import { useAuth } from '@/contexts/AuthContext';
import {
  SUPER_ADMIN_FILL_TABS,
  type SuperAdminTab,
} from '@/lib/superAdminTabs';

interface SuperAdminDashboardProps {
  /** Active section from the main Super Admin sidebar. */
  tab: SuperAdminTab;
}

/**
 * Platform admin content pane. Section switching lives in the main sidebar.
 */
export function SuperAdminDashboard({ tab }: SuperAdminDashboardProps) {
  const { user } = useAuth();
  const fillsViewport = SUPER_ADMIN_FILL_TABS.has(tab);
  const isDev = import.meta.env.DEV;

  return (
    <div
      className={`h-full min-h-0 ${
        fillsViewport ? 'overflow-hidden' : 'overflow-auto admin-table-scroll'
      }`}
    >
      {tab === 'dashboard' && <AllLoansTab />}
      {tab === 'clients' && <AdminClientsTab />}
      {tab === 'insurance' && <ClientInsuranceTab />}
      {tab === 'deductions' && <DeductedInstallmentsTab />}
      {tab === 'companies' && <CompaniesTab createdBy={user?.id ?? null} />}
      {tab === 'activity' && <AllActivityTab />}
      {tab === 'groups' && <CompanyGroupsTab />}
      {tab === 'superAdmins' && isDev && <PlatformAdminsTab />}
    </div>
  );
}
