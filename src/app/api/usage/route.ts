import { getStore } from '@netlify/blobs';
import { NextRequest, NextResponse } from 'next/server';

const FREE_SCAN_LIMIT = 50;

function isValidDeviceId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.length >= 10 && id.length <= 100;
}

async function getUsageCount(deviceId: string): Promise<number> {
  try {
    const store = getStore('materialdex-usage');
    const data = await store.get(deviceId, { type: 'json' }) as { count?: number } | null;
    return data?.count ?? 0;
  } catch {
    // Not on Netlify or Blobs unavailable (local dev) — allow all scans
    return 0;
  }
}

async function incrementUsage(deviceId: string): Promise<number> {
  try {
    const store = getStore('materialdex-usage');
    const existing = await store.get(deviceId, { type: 'json' }) as { count?: number } | null;
    const newCount = (existing?.count ?? 0) + 1;
    await store.setJSON(deviceId, { count: newCount, lastUsed: new Date().toISOString() });
    return newCount;
  } catch {
    return 1;
  }
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get('deviceId');
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
  }
  const count = await getUsageCount(deviceId);
  return NextResponse.json({ count, limit: FREE_SCAN_LIMIT, remaining: Math.max(0, FREE_SCAN_LIMIT - count) });
}

export async function POST(request: NextRequest) {
  let deviceId: string | undefined;
  try {
    const body = await request.json();
    deviceId = body.deviceId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
  }
  const count = await incrementUsage(deviceId);
  return NextResponse.json({ count, limit: FREE_SCAN_LIMIT, remaining: Math.max(0, FREE_SCAN_LIMIT - count) });
}
