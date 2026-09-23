export function createActorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `actor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
