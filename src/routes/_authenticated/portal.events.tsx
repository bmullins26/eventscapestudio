import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/events")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="My Events"
      description="Events you've applied to or been approved for."
      icon={CalendarDays}
      emptyTitle="No events yet"
      emptyDescription="Once an organizer invites you or you apply to an open event, it will show up here."
    />
  ),
});
