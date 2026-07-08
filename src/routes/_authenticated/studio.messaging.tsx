import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Megaphone } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/messaging")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Messaging"
      description="Direct messages with vendors plus broadcast announcements per event."
      icon={MessageSquare}
      emptyTitle="Nothing to say yet"
      emptyDescription="Send an announcement to reach every approved vendor at once, or open a direct thread with a specific vendor."
      action={<Button><Megaphone className="mr-2 h-4 w-4" /> New announcement</Button>}
    />
  ),
});
