import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/studio/applications")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Applications"
      description="Review pending applications, approve or waitlist vendors, and attach documents."
      icon={ClipboardCheck}
      emptyTitle="No applications yet"
      emptyDescription="Once vendors apply to an open event, they'll queue up here for your review."
    />
  ),
});
