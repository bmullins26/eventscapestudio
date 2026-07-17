/* -------------------------------------------------------------------------
 * EventWorkspaceContext — carries live event overlay data (event_booths +
 * applications + payments + reservations, and derived index) throughout the
 * workspace when mode === "event". Venue mode leaves this null.
 * ---------------------------------------------------------------------- */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildEventContext, deriveBoothState, type DerivedState, type EventContext } from "./derive";

export interface EventWorkspaceValue {
  eventId: string;
  eventName: string;
  organizationId: string;
  booths: Array<any>;
  applications: Array<any>;
  payments: Array<any>;
  reservations: Array<any>;
  ctx: EventContext;
  deriveByObjectId: (objectId: string | null | undefined) => DerivedState | null;
  refetch: () => void;
}

const EventWorkspaceContext = createContext<EventWorkspaceValue | null>(null);

export function EventWorkspaceProvider({
  eventId, eventName, organizationId,
  booths, applications, payments, reservations,
  onRefetch, children,
}: {
  eventId: string;
  eventName: string;
  organizationId: string;
  booths: Array<any>;
  applications: Array<any>;
  payments: Array<any>;
  reservations: Array<any>;
  onRefetch: () => void;
  children: ReactNode;
}) {
  const ctx = useMemo(() => buildEventContext({ booths, applications, payments }), [booths, applications, payments]);
  const value = useMemo<EventWorkspaceValue>(() => ({
    eventId, eventName, organizationId,
    booths, applications, payments, reservations,
    ctx,
    deriveByObjectId: (id) => deriveBoothState(id, ctx),
    refetch: onRefetch,
  }), [eventId, eventName, organizationId, booths, applications, payments, reservations, ctx, onRefetch]);
  return <EventWorkspaceContext.Provider value={value}>{children}</EventWorkspaceContext.Provider>;
}

/** Returns the event workspace value, or null when in venue mode. */
export function useEventWorkspace(): EventWorkspaceValue | null {
  return useContext(EventWorkspaceContext);
}
