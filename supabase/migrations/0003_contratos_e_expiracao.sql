-- =====================================================================
-- UaiCasa — 0003: modelos de contrato + expiração automática de reservas
-- Rode depois do 0002. Pode ser executado mais de uma vez.
-- =====================================================================

-- 1) Modelos de contrato (o texto é gerado pelo site; aqui fica o registro
--    da versão, exigido para guardar cada aceite em `contracts`).
insert into contract_templates (property_id, mode, version, title, body_md)
select p.id, m.mode, 1, m.title,
       'Texto gerado por src/lib/contracts/contract.ts — versão 2026.11-v1. ' ||
       'O texto integral aceito por cada locatário fica em contracts.rendered_html, com hash SHA-256.'
from properties p
cross join (values ('stay'::booking_mode,  'Contrato de Locação por Temporada'),
                   ('event'::booking_mode, 'Termo de Uso de Espaço para Eventos (Day Use)')) as m(mode, title)
where p.slug = 'uaicasa'
on conflict (property_id, mode, version) do nothing;

-- 2) Libera datas de reservas não pagas a cada 5 minutos.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'uaicasa-expirar-reservas';
select cron.schedule('uaicasa-expirar-reservas', '*/5 * * * *', 'select public.expire_pending_bookings()');

-- 3) Confere
select (select count(*) from contract_templates) as modelos_de_contrato,
       (select count(*) from cron.job where jobname = 'uaicasa-expirar-reservas') as agendamento_ativo;
