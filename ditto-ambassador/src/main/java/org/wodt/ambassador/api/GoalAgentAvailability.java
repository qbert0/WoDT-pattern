package org.wodt.ambassador.api;

public record GoalAgentAvailability(
        String goalAgentId,
        boolean available,
        String conflictingThingId
) {
}
