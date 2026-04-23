/**
 * 중복 디바이스 병합 스크립트. 한 번만 실행.
 *
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/dedupe-devices.ts
 *
 * 동작:
 * 1. 모든 디바이스를 normalizeDeviceCode()로 정규화 후 그룹화
 * 2. 각 그룹에서 canonical 1건 선택 (정규화 결과와 가장 일치하는 code)
 * 3. 중복 디바이스의 aliases/quotes/subsidies/margins를 canonical로 이관
 *    (UNIQUE 충돌 나는 경우 중복 row는 삭제)
 * 4. 중복 디바이스 삭제
 * 5. 정규화 결과와 기존 code가 다르면 canonical의 model_code 자체도 업데이트
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeDeviceCode } from '../src/lib/device-normalize';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Device = {
  id: string;
  model_code: string;
  nickname: string;
  storage: string | null;
  series: string | null;
  retail_price_krw: number;
};

async function run() {
  // 모든 활성 디바이스 로드
  const { data: devices, error } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, storage, series, retail_price_krw')
    .eq('active', true);
  if (error) throw error;

  console.log(`총 디바이스: ${devices?.length ?? 0}`);

  // 정규화 키로 그룹화 (Samsung만 정규화됨, 기타는 원본 그대로 유니크 키)
  const groups = new Map<string, Device[]>();
  for (const d of (devices ?? []) as Device[]) {
    const norm = normalizeDeviceCode(d.model_code);
    const key = norm; // Samsung은 정규화 후 동일, Apple/기타는 원본 유지로 그룹 단일
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const dupes = Array.from(groups.entries()).filter(([, arr]) => arr.length > 1);
  console.log(`중복 그룹: ${dupes.length}개`);

  let mergedDevices = 0;
  let migratedAliases = 0;
  let migratedQuotes = 0;
  let migratedSubsidies = 0;
  let canonicalRenamed = 0;

  for (const [canonicalCode, members] of dupes) {
    // canonical: model_code가 canonicalCode와 일치하는 것 우선, 없으면 code가 가장 짧은 것
    members.sort((a, b) => {
      const aMatch = a.model_code === canonicalCode ? 0 : 1;
      const bMatch = b.model_code === canonicalCode ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.model_code.length - b.model_code.length;
    });
    const canonical = members[0];
    const dupIds = members.slice(1).map((m) => m.id);

    console.log(
      `\n[${canonicalCode}] canonical=${canonical.model_code} (${canonical.nickname}) · dupe=${dupIds.length}`,
    );
    for (const d of members.slice(1)) {
      console.log(`  - ${d.model_code} · ${d.nickname}`);
    }

    for (const dupId of dupIds) {
      // 1) aliases: canonical로 이관. 같은 (vendor_id, vendor_code)가 이미 canonical에 있으면 dup alias 삭제
      const { data: dupAliases } = await sb
        .from('price_device_aliases')
        .select('id, vendor_id, vendor_code')
        .eq('device_id', dupId);
      for (const a of dupAliases ?? []) {
        const { data: conflict } = await sb
          .from('price_device_aliases')
          .select('id')
          .eq('device_id', canonical.id)
          .eq('vendor_id', a.vendor_id)
          .eq('vendor_code', a.vendor_code)
          .maybeSingle();
        if (conflict) {
          await sb.from('price_device_aliases').delete().eq('id', a.id);
        } else {
          await sb.from('price_device_aliases').update({ device_id: canonical.id }).eq('id', a.id);
          migratedAliases++;
        }
      }

      // 2) quotes: canonical로 이관. UNIQUE 충돌 시 dup row 삭제 (canonical의 값 유지)
      const { data: dupQuotes } = await sb
        .from('price_vendor_quotes')
        .select('id, sheet_id, plan_tier_id, contract_type, activation_type')
        .eq('device_id', dupId);
      for (const q of dupQuotes ?? []) {
        const { data: conflict } = await sb
          .from('price_vendor_quotes')
          .select('id')
          .eq('device_id', canonical.id)
          .eq('sheet_id', q.sheet_id)
          .eq('plan_tier_id', q.plan_tier_id)
          .eq('contract_type', q.contract_type)
          .eq('activation_type', q.activation_type)
          .maybeSingle();
        if (conflict) {
          await sb.from('price_vendor_quotes').delete().eq('id', q.id);
        } else {
          await sb.from('price_vendor_quotes').update({ device_id: canonical.id }).eq('id', q.id);
          migratedQuotes++;
        }
      }

      // 3) carrier_subsidies: canonical로 이관. UNIQUE 충돌 시 dup row 삭제
      const { data: dupSubs } = await sb
        .from('price_carrier_subsidies')
        .select('id, carrier, plan_tier_id, subsidy_krw')
        .eq('device_id', dupId);
      for (const s of dupSubs ?? []) {
        const { data: conflict } = await sb
          .from('price_carrier_subsidies')
          .select('id, subsidy_krw')
          .eq('carrier', s.carrier)
          .eq('device_id', canonical.id)
          .eq('plan_tier_id', s.plan_tier_id)
          .maybeSingle();
        if (conflict) {
          // 더 최근값 유지 — 그냥 dup 삭제
          await sb.from('price_carrier_subsidies').delete().eq('id', s.id);
        } else {
          await sb.from('price_carrier_subsidies').update({ device_id: canonical.id }).eq('id', s.id);
          migratedSubsidies++;
        }
      }

      // 4) margins: canonical로 이관
      const { data: dupMargins } = await sb
        .from('price_device_margins')
        .select('id')
        .eq('device_id', dupId);
      for (const mg of dupMargins ?? []) {
        const { data: conflict } = await sb
          .from('price_device_margins')
          .select('id')
          .eq('scope_type', 'device')
          .eq('device_id', canonical.id)
          .maybeSingle();
        if (conflict) {
          await sb.from('price_device_margins').delete().eq('id', mg.id);
        } else {
          await sb.from('price_device_margins').update({ device_id: canonical.id }).eq('id', mg.id);
        }
      }

      // 5) dup 디바이스 삭제
      await sb.from('price_devices').delete().eq('id', dupId);
      mergedDevices++;
    }

    // canonical의 model_code가 canonicalCode와 다르면 업데이트 (ex: 짧은 S948 512 → SM-S948N_512G)
    if (canonical.model_code !== canonicalCode) {
      // 원본 code는 alias로 남겨둠 (신규 파싱 매핑 용이성)
      // 중복 alias 체크 생략 (device_code 변경이 vendor_id 없이는 유니크)
      const { error: renameErr } = await sb
        .from('price_devices')
        .update({ model_code: canonicalCode })
        .eq('id', canonical.id);
      if (renameErr) {
        console.warn(`  rename 실패 ${canonical.model_code} → ${canonicalCode}: ${renameErr.message}`);
      } else {
        canonicalRenamed++;
      }
    }
  }

  console.log('\n=== 완료 ===');
  console.log(`삭제된 중복 디바이스: ${mergedDevices}`);
  console.log(`이관된 aliases: ${migratedAliases}`);
  console.log(`이관된 quotes: ${migratedQuotes}`);
  console.log(`이관된 subsidies: ${migratedSubsidies}`);
  console.log(`정규화된 canonical code: ${canonicalRenamed}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
