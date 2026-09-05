// Pure asset-path resolvers: single source of truth for the public/assets
// folder conventions:
//   actors:  public/assets/actors/<id>/frames/{idle,walk}.json + speech/talking.png
//   levels:  public/assets/levels/<id>.webp
// These tiny path strings are duplicated (with a comment pointing back here)
// inside scripts/validate-content.mjs, which stays dependency-free Node.

/** "/assets/actors/<id>/frames/<state>.json" — animation sheet manifest. */
export function resolveActorFrameSheet(
  actorId: string,
  state: "idle" | "walk",
): string {
  return `/assets/actors/${actorId}/frames/${state}.json`;
}

/** "/assets/actors/<id>/speech/talking.png" — dialogue portrait. */
export function resolveActorPortrait(actorId: string): string {
  return `/assets/actors/${actorId}/speech/talking.png`;
}

/** "/assets/levels/<levelId>.webp" — level background image. */
export function resolveLevelBackground(levelId: string): string {
  return `/assets/levels/${levelId}.webp`;
}
