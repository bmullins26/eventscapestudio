import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendor/dashboard")({
  component: VendorDashboard,
});

function VendorDashboard() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Vendor portal" title="Welcome!" description="Browse events, submit applications, and track your bookings." />
      <EmptyState icon={Store} title="Start by browsing open events" description="Head to Browse Events to find your next market or festival." />
    </div>
  );
}
