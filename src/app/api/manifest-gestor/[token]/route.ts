import { NextResponse } from "next/server";
import { manifestParaRuta } from "@/lib/pwaManifest";

export function GET(_req: Request, { params }: { params: { token: string } }) {
  return NextResponse.json(manifestParaRuta(`/g/${params.token}`), {
    headers: { "Content-Type": "application/manifest+json" }
  });
}
