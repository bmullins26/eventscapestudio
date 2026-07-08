import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/messages")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Messages"
      description="Direct conversations with the organizers of your events."
      icon={MessageSquare}
      emptyTitle="No messages"
      emptyDescription="When an organizer sends you a message, it will appear here."
    />
  ),
});
