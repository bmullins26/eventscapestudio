import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/portal/profile")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Business Profile"
      description="Your public vendor profile — one master record shared with every organizer you work with."
      icon={Store}
      emptyTitle="Profile setup"
      emptyDescription="Add your business name, logo, categories, and contact information. Organizers browse this when reviewing applications."
      action={<Button>Edit profile</Button>}
    />
  ),
});
