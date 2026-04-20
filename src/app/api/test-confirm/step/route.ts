// DEV TEST ONLY — direct invocation of confirm/autoregister logic without Server Action protocol.
// TODO: remove after Phase 2 browser verification.
import { NextResponse } from 'next/server';
import { autoRegisterMissingDevices, confirmSheet } from '@/app/(app)/uploads/[id]/actions';

export async function POST(req: Request) {
  const { sheet_id, step } = await req.json();
  if (!sheet_id) return NextResponse.json({ error: 'sheet_id 필수' }, { status: 400 });
  const fd = new FormData();
  fd.set('sheet_id', sheet_id);
  try {
    if (step === 'auto-register') {
      await autoRegisterMissingDevices(fd);
    } else if (step === 'confirm') {
      await confirmSheet(fd);
    } else {
      return NextResponse.json({ error: 'step must be auto-register | confirm' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // redirect()는 NEXT_REDIRECT 에러를 throw해서 여기로 떨어지는데 그건 성공 신호
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('NEXT_REDIRECT')) return NextResponse.json({ ok: true, redirected: true });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
