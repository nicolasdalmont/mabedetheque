// Set right before navigating to an album, read back on the gallery page so
// the list can scroll to where that album is rather than resetting to the
// top when the user comes back to it.
export const LAST_ALBUM_KEY = "mabedetheque:last-album-id";

// A single dead cover_url (404 on Object Storage) got written to 423 of the
// 875 albums — about half the collection — apparently by whatever bulk
// process attempted a cover search for albums that had none, instead of
// leaving cover_url empty on failure. It's non-empty so a plain truthy
// check treats it as "has a cover"; treated as equivalent to "no cover"
// wherever that distinction matters (series cover pick, "no cover" counts).
// The underlying rows are untouched — this is a display-time workaround.
export const KNOWN_DEAD_COVER_URL =
  "https://br-icy-forest-a5gmcjl7.storage.c-1.us-east-2.aws.neon.tech/mabedetheque-covers/covers/aee360a3-442c-4dc9-a70f-3ce7c26d5c28.webp";
