import { NextResponse } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase';

export async function GET() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: '0-99',
      },
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errDetail = await res.text();
      return NextResponse.json({ error: errDetail }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        usuario: body.usuario,
        clave: body.clave,
      }),
    });

    const responseText = await res.text();
    
    if (!res.ok) {
      return NextResponse.json({ error: responseText }, { status: res.status });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { success: true };
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}