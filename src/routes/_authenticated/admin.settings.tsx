import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="Global Settings"
      description="Platform-wide defaults, feature flags, and system configuration."
      icon={Settings}
      emptyTitle="Global settings"
      emptyDescription="Fine-grained platform controls will live here."
    />
  ),
});
