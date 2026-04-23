-- 0009_fk_cascade.sql
-- 디바이스 삭제 시 연관 데이터 자동 정리 (restrict → cascade)

alter table price_vendor_quotes
  drop constraint if exists price_vendor_quotes_device_id_fkey,
  add constraint price_vendor_quotes_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_carrier_subsidies
  drop constraint if exists price_carrier_subsidies_device_id_fkey,
  add constraint price_carrier_subsidies_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_device_margins
  drop constraint if exists price_device_margins_device_id_fkey,
  add constraint price_device_margins_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_device_aliases
  drop constraint if exists price_device_aliases_device_id_fkey,
  add constraint price_device_aliases_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;
