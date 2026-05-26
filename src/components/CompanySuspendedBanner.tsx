import { useAuth } from '@/contexts/AuthContext';

/** Shown when the provisioned company is suspended (read-only for tenants). */
export function CompanySuspendedBanner() {
  const { company, userRole } = useAuth();
  if (!company || company.status !== 'suspended') return null;
  if (userRole === 'platform_admin') return null;

  return (
    <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] text-ink">
      <strong className="font-medium">{company.name}</strong> is suspended. You can view data but
      cannot add or edit until your administrator reactivates the company.
    </div>
  );
}
