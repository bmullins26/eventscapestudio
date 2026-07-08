import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Super Admin" description="Manage organizations, subscriptions, and support requests across EventScape Studio." />
      <EmptyState icon={ShieldCheck} title="Platform overview" description="Detailed analytics, organization management, and support tools appear here." />
    </div>
  );
}
