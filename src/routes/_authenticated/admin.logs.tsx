import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="System Logs"
      description="Audit trail of privileged actions across the platform."
      icon={ScrollText}
      emptyTitle="No log entries"
      emptyDescription="Privileged actions and audits will stream in here."
    />
  ),
});
