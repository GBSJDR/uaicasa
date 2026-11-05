-- =====================================================================
-- UaiCasa — 0002: endurecimento de segurança para o Supabase
-- Rode DEPOIS do 0001_init.sql. Pode ser executado mais de uma vez.
-- =====================================================================

-- 1) Funções: no Postgres, toda função nova pode ser executada por qualquer
--    papel (PUBLIC). No Supabase isso inclui `anon` (visitante sem login).
--    create_booking só pode ser chamada pelo servidor do site (service_role),
--    que recalcula o preço antes; senão alguém poderia reservar pelo preço
--    que quisesse.
revoke execute on function create_booking(uuid, jsonb, booking_mode, date, date, timestamptz, timestamptz, int, text, jsonb, booking_source)
  from public, anon, authenticated;
grant execute on function create_booking(uuid, jsonb, booking_mode, date, date, timestamptz, timestamptz, int, text, jsonb, booking_source)
  to service_role;

revoke execute on function expire_pending_bookings() from public, anon, authenticated;
grant execute on function expire_pending_bookings() to service_role;

-- 2) Views de relatório: por padrão uma view ignora o RLS das tabelas.
--    security_invoker faz a view respeitar o RLS de quem consulta (só admin).
alter view v_dre_monthly set (security_invoker = true);
alter view v_occupancy_monthly set (security_invoker = true);
revoke all on v_dre_monthly, v_occupancy_monthly from anon;

-- 3) Calendário público: visitante vê só os períodos ocupados, sem o motivo
--    nem o vínculo com a reserva.
revoke select on occupancy from anon;
grant select (property_id, period, active, kind) on occupancy to anon;
