import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Events" description="Every craft show, market, and festival you're running." />
      <EmptyState
        icon={Construction}
        title="Events workspace coming next"
        description="The event creation wizard, booth map editor, applications queue, and reports are wired to your database and will appear here in the next iteration."
      />
    </div>
  );
}
