import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Studio settings" description="Update your organization profile, branding, and preferences." />
      <EmptyState icon={Settings} title="Settings coming soon" />
    </div>
  );
}
