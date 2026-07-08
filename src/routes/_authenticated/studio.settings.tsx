import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/studio/settings")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Organization Settings"
      description="Brand, contact information, subscription tier, and workspace preferences."
      icon={Settings}
      emptyTitle="Settings coming soon"
      emptyDescription="Fine-grained organization configuration will land here."
    />
  ),
});
