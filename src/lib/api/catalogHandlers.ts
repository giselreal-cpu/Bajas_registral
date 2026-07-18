import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Factory de handlers para catálogos simples (una tabla, sin relaciones
// complejas): aseguradoras, desarmaderos, registros_automotores, tipos_baja.

export function createCatalogListHandlers(
  table: string,
  orderBy: string,
  allowedFields: string[]
) {
  async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from(table).select("*").order(orderBy);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  async function POST(request: NextRequest) {
    const supabase = createClient();
    const body = await request.json();

    const insert: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) insert[field] = body[field] === "" ? null : body[field];
    }

    const { data, error } = await supabase
      .from(table)
      .insert(insert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  }

  return { GET, POST };
}

export function createCatalogItemHandlers(table: string, allowedFields: string[]) {
  async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    const supabase = createClient();
    const body = await request.json();

    const update: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) update[field] = body[field] === "" ? null : body[field];
    }

    const { data, error } = await supabase
      .from(table)
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", params.id);

    if (error) {
      // Lo más común: el registro está referenciado desde `casos` (FK).
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return { PUT, DELETE };
}
