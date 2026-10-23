-- Conversão das OS antigas para os motivos da tabela reasons.
-- Rodar DEPOIS de criar e popular reasons e as colunas *_reason_id,
-- e ANTES de remover as colunas de texto antigas.
-- Liga pelo texto (type + label), não por id: funciona mesmo que os ids
-- de produção sejam diferentes dos da homologação.

-- 1) Improdutiva: as 13 frases que existem em produção têm par na lista nova.
UPDATE public.service_orders so
   SET unproductive_reason_id = r.id
  FROM (VALUES
        ('cliente não estava no local no horário agendado',                    'Cliente ausente'),
        ('absent_customer',                                                    'Cliente ausente'),
        ('especificar nas observações adcionais',                              'Outros motivos'),
        ('other_reason',                                                       'Outros motivos'),
        ('falta de energia, problema de rede local, obras no local',           'Falta de energia, rede local ou obras no local'),
        ('infra_issue',                                                        'Falta de energia, rede local ou obras no local'),
        ('chuva forte, tempestade ou condições de segurança inadequadas',      'Condições climáticas ou segurança inadequada'),
        ('weather_conditions',                                                 'Condições climáticas ou segurança inadequada'),
        ('cliente cancelou o serviço no momento da visita',                    'Cliente cancelou no momento da visita'),
        ('cancellation_by_customer',                                           'Cliente cancelou no momento da visita'),
        ('não foi possivel acessar o local (porteiro, condomínio, etc)',       'Acesso ao local não permitido'),
        ('material necessário não disponível no estoque do técnico',           'Material indisponível no estoque do técnico'),
        ('equipamento danificado, falta de sinal, infraestrutura inadequada',  'Equipamento danificado, falta de sinal ou infraestrutura inadequada')
       ) AS m(texto_antigo, label_novo)
  JOIN public.reasons r
    ON r.type = 'service_order_unproductive'
   AND r.label = m.label_novo
   AND r.deleted_at IS NULL
 WHERE so.unproductive_reason_id IS NULL
   AND lower(btrim(so.unproductive_reason)) = lower(m.texto_antigo);

-- 2) Reagendamento feito pelo próprio cliente: frase fixa do sistema.
--    O resto do reagendamento é texto livre e fica sem id.
UPDATE public.service_orders so
   SET rescheduling_reason_id = r.id
  FROM public.reasons r
 WHERE r.type = 'service_order_reschedule'
   AND r.label = 'Reagendamento realizado pelo Cliente.'
   AND r.deleted_at IS NULL
   AND so.rescheduling_reason_id IS NULL
   AND lower(btrim(so.rescheduling_reason)) = 'reagendamento realizado pelo cliente.';

-- 3) Encerramento: texto livre (349 variações em produção), sem conversão.
