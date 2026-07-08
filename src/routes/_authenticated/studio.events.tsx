import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/events")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Events"
      description="Create shows, clone previous years, and manage every layer of an event in one workspace."
      icon={CalendarDays}
      emptyTitle="No events yet"
      emptyDescription="Create your first event or clone one from a previous year to get started."
      action={<Button><Plus className="mr-2 h-4 w-4" /> New event</Button>}
    />
  ),
});
