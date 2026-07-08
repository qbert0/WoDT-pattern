package org.wodt.ambassador.api;

public record ApiError(String code, String message, String thingId) {
}
