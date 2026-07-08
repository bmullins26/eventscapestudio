import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/venues")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Venue Directory"
      description="Permanent venue records with reusable maps, layouts, parking, and utilities. Events reference venues — they never modify them."
      icon={MapPin}
      emptyTitle="No venues yet"
      emptyDescription="Add your first venue so every future event can reference the same location, layout templates, and site information."
      action={<Button><Plus className="mr-2 h-4 w-4" /> Add venue</Button>}
    />
  ),
});
