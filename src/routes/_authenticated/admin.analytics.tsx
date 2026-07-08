import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="Analytics"
      description="Growth, engagement, and event volume across the platform."
      icon={BarChart3}
      emptyTitle="Analytics coming soon"
      emptyDescription="Dashboards will populate as event volume grows."
    />
  ),
});
