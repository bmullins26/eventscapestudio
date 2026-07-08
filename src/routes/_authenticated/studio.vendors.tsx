import { createFileRoute } from "@tanstack/react-router";
import { Store, UserPlus } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/vendors")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Vendor Directory"
      description="Your organization's CRM: notes, ratings, favorites, preferred booth, and full history across every event you've run."
      icon={Store}
      emptyTitle="No vendors linked yet"
      emptyDescription="Invite vendors by email, secure link, or invitation code. Vendor accounts are always linked to one master profile — no duplicates."
      action={<Button><UserPlus className="mr-2 h-4 w-4" /> Invite vendor</Button>}
    />
  ),
});
