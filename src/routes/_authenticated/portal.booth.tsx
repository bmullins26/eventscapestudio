import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/booth")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="My Booth"
      description="Your booth assignment and location on the event map."
      icon={Map}
      emptyTitle="No booth assigned"
      emptyDescription="Booth assignments appear here after an organizer approves your application and places you on the map."
    />
  ),
});
