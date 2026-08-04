import { getHealthPayload } from "@/lib/health";

export function GET() {
  return Response.json(getHealthPayload(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
