import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/studio/booths")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Booths"
      description="Design layouts once per venue, then generate per-event booth maps and assign approved vendors."
      icon={Map}
      emptyTitle="No layout yet"
      emptyDescription="Add a venue and create a layout template — you'll be able to design booths on a drag-and-drop canvas."
    />
  ),
});
