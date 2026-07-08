import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/help")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Help"
      description="Guides, FAQs, and a direct line to support."
      icon={HelpCircle}
      emptyTitle="We're here for you"
      emptyDescription="Help articles and a contact form will land here soon."
    />
  ),
});
