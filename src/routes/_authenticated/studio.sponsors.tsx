import { createFileRoute } from "@tanstack/react-router";
import { Heart, Plus } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/sponsors")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Sponsors"
      description="Sponsor tiers, contributions, and contacts across every event."
      icon={Heart}
      emptyTitle="No sponsors yet"
      emptyDescription="Add your first sponsor to start tracking contributions and tier placement."
      action={<Button><Plus className="mr-2 h-4 w-4" /> Add sponsor</Button>}
    />
  ),
});
