export const healthPayload = {
  status: "ok",
  service: "vibesource",
  milestone: "M1-runnable-foundation",
} as const;

export function getHealthPayload() {
  return healthPayload;
}
