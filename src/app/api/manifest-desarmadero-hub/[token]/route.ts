import { NextResponse } from "next/server";
import { manifestParaRuta } from "@/lib/pwaManifest";

export function GET(_req: Request, { params }: { params: { token: string } }) {
  return NextResponse.json(manifestParaRuta(`/desarmadero/${params.token}`), {
    headers: { "Content-Type": "application/manifest+json" }
  });
}
