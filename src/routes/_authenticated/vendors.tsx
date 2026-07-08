import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendors")({
  component: VendorsPage,
});

function VendorsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Vendor directory" description="All vendors who've applied to your events." />
      <EmptyState icon={Store} title="No vendors yet" description="Vendors added through applications or manually will appear here." />
    </div>
  );
}
