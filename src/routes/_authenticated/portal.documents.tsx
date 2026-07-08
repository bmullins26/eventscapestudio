import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/documents")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Documents"
      description="Licenses, insurance certificates, and files organizers have shared with you."
      icon={FileText}
      emptyTitle="No documents"
      emptyDescription="Upload your licenses and certificates here so they're ready when an organizer requests them."
    />
  ),
});
