package org.wodt.ambassador.api;

public record GoalRootAvailability(
        String goalRootId,
        boolean available,
        String conflictingThingId
) {
}
