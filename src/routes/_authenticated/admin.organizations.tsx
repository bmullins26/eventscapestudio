import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="Organizations"
      description="Every organization on the platform. Suspend, unsuspend, and audit."
      icon={Building2}
      emptyTitle="No organizations yet"
      emptyDescription="Organizations appear here as organizers sign up."
    />
  ),
});
