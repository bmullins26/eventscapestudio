import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/announcements")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Announcements"
      description="Broadcast updates from the organizers you work with."
      icon={Megaphone}
      emptyTitle="No announcements"
      emptyDescription="Event-wide announcements from organizers will show up here."
    />
  ),
});
