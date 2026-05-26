import { useState } from 'react';
import { CompaniesTab } from '@/components/superAdmin/CompaniesTab';
import { AllLoansTab } from '@/components/superAdmin/AllLoansTab';
import { AllActivityTab } from '@/components/superAdmin/AllActivityTab';
import { CompanyGroupsTab } from '@/components/superAdmin/CompanyGroupsTab';
import { PlatformAdminsTab } from '@/components/superAdmin/PlatformAdminsTab';
import { useAuth } from '@/contexts/AuthContext';

type SuperAdminTab = 'companies' | 'loans' | 'activity' | 'groups' | 'superAdmins';

const isDev = import.meta.env.DEV;

const BASE_TABS: { id: SuperAdminTab; label: string }[] = [
  { id: 'companies', label: 'Companies' },
  { id: 'loans', label: 'All loans' },
  { id: 'activity', label: 'All activity' },
  { id: 'groups', label: 'Client groups' },
];

const DEV_TAB: { id: SuperAdminTab; label: string } = {
  id: 'superAdmins',
  label: 'Super admins',
};

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const tabs = isDev ? [...BASE_TABS, DEV_TAB] : BASE_TABS;
  const [tab, setTab] = useState<SuperAdminTab>('companies');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Super Admin</h1>
      </div>

      <p className="text-muted2 text-[13px] mb-5 max-w-2xl">
        Provision companies, invite team admins, and monitor loans and worksheet activity across
        all tenants.
      </p>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-border pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted2 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'companies' && <CompaniesTab createdBy={user?.id ?? null} />}
      {tab === 'loans' && <AllLoansTab />}
      {tab === 'activity' && <AllActivityTab />}
      {tab === 'groups' && <CompanyGroupsTab />}
      {tab === 'superAdmins' && isDev && <PlatformAdminsTab />}
    </div>
  );
}
