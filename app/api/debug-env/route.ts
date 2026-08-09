import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_role_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    service_role_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 15) ?? 'MISSING',
  });
}