import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/studio/reports")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Reports"
      description="Attendance, revenue, vendor performance, and category breakdowns — exportable to CSV."
      icon={BarChart3}
      emptyTitle="No reports generated"
      emptyDescription="Run your first event and reports will populate automatically."
    />
  ),
});
