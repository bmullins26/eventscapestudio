import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/applications")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="My Applications"
      description="Track pending, approved, waitlisted, and rejected applications across all organizers."
      icon={ClipboardCheck}
      emptyTitle="No applications yet"
      emptyDescription="Apply to an event and you'll see its status here."
    />
  ),
});
