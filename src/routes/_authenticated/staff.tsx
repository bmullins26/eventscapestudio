import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

function StaffPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Staff & coordinators" description="Invite teammates and control what they can access." />
      <EmptyState icon={UserCog} title="No staff invited yet" description="Invite coordinators and give each a permission profile." />
    </div>
  );
}
