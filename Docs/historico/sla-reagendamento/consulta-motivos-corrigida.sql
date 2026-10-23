-- Motivos de improdutiva, reagendamento e encerramento por OS.
-- OS com motivo escolhido na lista: nome da tabela reasons.
-- OS antiga, sem id: último motivo gravado no histórico, trocado pelo nome
-- da lista quando tem par; texto sem nenhuma palavra (".", "..", "ok") vira nulo.
with ultimo as (
    -- último registro de cada tipo no histórico da OS
    select distinct on (h.service_order_id, h.type)
           h.service_order_id,
           h.type,
           case h.type when 'unproductive' then 'service_order_unproductive'
                       when 'rescheduled'  then 'service_order_reschedule'
                       else 'service_order_close' end reason_type,
           btrim(h.reason, E' \t\r\n') texto
    from public.service_order_history h
    where h.type in ('unproductive', 'rescheduled', 'closed')
      and h.deleted_at is null
    order by h.service_order_id, h.type, h.created_at desc
),
de_para (texto, label) as (
    -- frases antigas do app para improdutiva -> nome novo da lista
    values ('cliente não estava no local no horário agendado',                   'Cliente ausente'),
           ('especificar nas observações adcionais',                             'Outros motivos'),
           ('falta de energia, problema de rede local, obras no local',          'Falta de energia, rede local ou obras no local'),
           ('chuva forte, tempestade ou condições de segurança inadequadas',     'Condições climáticas ou segurança inadequada'),
           ('cliente cancelou o serviço no momento da visita',                   'Cliente cancelou no momento da visita'),
           ('não foi possivel acessar o local (porteiro, condomínio, etc)',      'Acesso ao local não permitido'),
           ('material necessário não disponível no estoque do técnico',          'Material indisponível no estoque do técnico'),
           ('equipamento danificado, falta de sinal, infraestrutura inadequada', 'Equipamento danificado, falta de sinal ou infraestrutura inadequada')
),
historico as (
    select u.service_order_id,
           max(u.motivo) filter (where u.type = 'unproductive') improdutiva,
           max(u.motivo) filter (where u.type = 'rescheduled')  reagendamento,
           max(u.motivo) filter (where u.type = 'closed')       encerramento
    from (select u.service_order_id,
                 u.type,
                 coalesce(r.label,   -- texto igual a um nome da lista
                          m.label,   -- frase antiga da improdutiva
                          case when u.texto ~ '[[:alpha:]]{3}' then u.texto end) motivo
          from ultimo u
                   left join de_para m on m.texto = lower(u.texto) and u.type = 'unproductive'
                   left join lateral (select r.label
                                      from public.reasons r
                                      where r.type = u.reason_type
                                        and lower(r.label) = lower(u.texto)
                                      order by r.deleted_at nulls first
                                      limit 1) r on true) u
    group by u.service_order_id
)
select so.code,
       so.scheduled_date,
       so.status,
       coalesce(unproductive_reason.label, hi.improdutiva)   "unproductive_reason",
       coalesce(rescheduling_reason.label, hi.reagendamento) "rescheduling_reason",
       coalesce(closing_reason.label, hi.encerramento)       "closing_reason"
from public.service_orders so
         left join public.reasons unproductive_reason on unproductive_reason.id = so.unproductive_reason_id
         left join public.reasons rescheduling_reason on rescheduling_reason.id = so.rescheduling_reason_id
         left join public.reasons closing_reason      on closing_reason.id      = so.closing_reason_id
         left join historico hi on hi.service_order_id = so.id
where so.deleted_at is null
  and so.scheduled_date is not null
order by so.scheduled_date desc, so.code;
