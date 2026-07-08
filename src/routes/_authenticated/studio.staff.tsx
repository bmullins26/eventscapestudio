import { createFileRoute } from "@tanstack/react-router";
import { UserCog, UserPlus } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/staff")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Staff"
      description="Invite team members and grant granular permissions — nothing is hard-coded to role alone."
      icon={UserCog}
      emptyTitle="No staff yet"
      emptyDescription="Invite your first team member and tick exactly the permissions they need."
      action={<Button><UserPlus className="mr-2 h-4 w-4" /> Invite staff</Button>}
    />
  ),
});
