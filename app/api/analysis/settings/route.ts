import { NextResponse } from "next/server";
import { isAnalysisDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

/** Public capability flag — no secrets. */
export async function GET() {
  return NextResponse.json({
    databasePersistenceEnabled: isAnalysisDbConfigured(),
  });
}
