import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="Support"
      description="Incoming support requests and platform-level tickets."
      icon={LifeBuoy}
      emptyTitle="No open tickets"
      emptyDescription="Requests from organizations will queue up here."
    />
  ),
});
