/**
 * Shared user-facing error strings. Kept here so every entry point reports the
 * same failure the same way instead of duplicating literals.
 */

/** Reported when BroadcastChannel is unavailable in this environment */
export const CHANNEL_NOT_SUPPORTED_ERROR =
  'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
