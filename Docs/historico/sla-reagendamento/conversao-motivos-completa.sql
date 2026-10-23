-- Conversão COMPLETA dos motivos antigos (texto) para a tabela reasons.
-- Cobre as três colunas que o deploy remove: unproductive_reason,
-- rescheduling_reason e closing_reason.
--
-- ORDEM: rodar DEPOIS de criar e popular public.reasons e as colunas
-- *_reason_id, e ANTES do drop das colunas de texto. Tudo na MESMA sessão
-- (usa tabela temporária).
--
-- Como funciona: cada texto antigo é normalizado (minúsculas, sem acento,
-- espaços juntos) e passa por uma lista de regras em ordem de prioridade;
-- vale a primeira que casar. A ligação com reasons é pelo NOME do motivo
-- (type + label), não pelo id. Só preenche OS com *_reason_id vazio, então
-- não mexe no que já tiver sido preenchido por outro script.
--
-- O que NÃO converte, de propósito: texto sem conteúdo (".", "ok",
-- "reagendamento", "adiamento"...), nome de técnico solto, link de mapa e
-- pedidos de pessoas cujo papel não está claro. Reagendamento e encerramento
-- não têm "Outros" na reasons, então esses ficam sem id. O texto original
-- de TUDO fica guardado no backup do passo 0.
--
-- Medido em produção em 20/10/2026 (prévia do passo 2).

-- 0) Backup dos textos antigos (uma vez, antes de tudo).
CREATE TABLE IF NOT EXISTS public.service_orders_motivos_backup AS
SELECT id, unproductive_reason, rescheduling_reason, closing_reason, now() AS copiado_em
FROM public.service_orders
WHERE coalesce(unproductive_reason, rescheduling_reason, closing_reason) IS NOT NULL;

-- 1) Classificação de cada OS (tabela temporária da sessão).
DROP TABLE IF EXISTS pg_temp.motivos_convertidos;
CREATE TEMP TABLE motivos_convertidos AS
WITH de_para (tipo, prioridade, padrao, label) AS (
  VALUES
    ('service_order_unproductive', 1, '^cliente nao estava no local', 'Cliente ausente'),
    ('service_order_unproductive', 2, '^absent_customer$', 'Cliente ausente'),
    ('service_order_unproductive', 3, '^especificar nas observacoes', 'Outros motivos'),
    ('service_order_unproductive', 4, '^other_reason$', 'Outros motivos'),
    ('service_order_unproductive', 5, '^falta de energia', 'Falta de energia, rede local ou obras no local'),
    ('service_order_unproductive', 6, '^infra_issue$', 'Falta de energia, rede local ou obras no local'),
    ('service_order_unproductive', 7, '^chuva forte', 'Condições climáticas ou segurança inadequada'),
    ('service_order_unproductive', 8, '^weather_conditions$', 'Condições climáticas ou segurança inadequada'),
    ('service_order_unproductive', 9, '^cliente cancelou o servico no momento', 'Cliente cancelou no momento da visita'),
    ('service_order_unproductive', 10, '^cancellation_by_customer$', 'Cliente cancelou no momento da visita'),
    ('service_order_unproductive', 11, '^nao foi possivel acessar', 'Acesso ao local não permitido'),
    ('service_order_unproductive', 12, '^material necessario', 'Material indisponível no estoque do técnico'),
    ('service_order_unproductive', 13, '^equipamento danificado', 'Equipamento danificado, falta de sinal ou infraestrutura inadequada'),
    ('service_order_reschedule', 14, '^nao foi feit', NULL::text),
    ('service_order_reschedule', 15, '^reagendamento realizado pelo cliente\.?$', 'Reagendamento realizado pelo Cliente.'),
    ('service_order_reschedule', 16, 'chuv|chov|telha\w* (ta |esta |estao )?molhad', 'Condições climáticas'),
    ('service_order_reschedule', 17, 'sem energia|nao tem energia|eletr[ie]cista', 'Local sem energia'),
    ('service_order_reschedule', 18, 'local sem iluminacao', 'Local sem iluminação ou condição segura de atendimento'),
    ('service_order_reschedule', 19, 'internet ainda nao|nao tem internet|instalacao da internet|instalad[ao] a internet|internet sera instalada|fibra vai ser feita|caixa sera ativa', 'Internet ou fibra ainda não instalada'),
    ('service_order_reschedule', 20, 'quebra( de)? agenda|^quebra$|trabalho anterior|atraso demanda do tecnico|sem tecnico disponi', 'Quebra de agenda técnica'),
    ('service_order_reschedule', 21, '\minfra|\mcto\M|\mporta\M|viavi|projeto', 'Infraestrutura pendente'),
    ('service_order_reschedule', 22, 'nao havia horario|sem horario disponivel|sem periodo', 'Sem horário disponível no período solicitado'),
    ('service_order_reschedule', 23, 'sem data|nao havia data|nao tinha data|\msm data', 'Sem data disponível no agendamento'),
    ('service_order_reschedule', 24, 'nao retiramos|nao tem rota|sem rota', 'Indisponibilidade de rota'),
    ('service_order_reschedule', 25, 'agendamento (errado|incorreto)|agendamento correto e|equivocad|data indevida|em que a cliente nao estaria|selecionei o periodo|^era de sexta$|gerada automaticamente|problema no sgi', 'Agendamento incorreto'),
    ('service_order_reschedule', 26, 'mudanca de endereco|antigo endereco', 'Mudança de endereço'),
    ('service_order_reschedule', 27, 'retrabalho|segundo ponto|improdutiv|finalizar a instalacao|ira terminar|opticals', 'Pendência técnica no local'),
    ('service_order_reschedule', 28, 'aguardando retorno|supervisor|^planejamento$', 'Aguardando retorno interno'),
    ('service_order_reschedule', 29, 'sem confirmacao|sem ctt|vai retornar quando|aguardando foto', 'Aguardando confirmação do cliente'),
    ('service_order_reschedule', 30, 'cliente ausente|nao esta na residencia|nao estara na residencia|se ausentar|imprevisto|contra ?tempos', 'Cliente ausente'),
    ('service_order_reschedule', 31, 'so pode no periodo da tarde', 'Cliente sem disponibilidade no horário agendado'),
    ('service_order_reschedule', 32, 'servico adiantado a pedido|cliente solicitou (a instalacao|o agendamento) para hoje|data mais proxima|se nao for hoje|pediu pra hj', 'Cliente solicitou antecipação'),
    ('service_order_reschedule', 33, 'encaixe|enxaice|desistencia|adiant|adiat|antecip|puxa[dr]|hoje|\mhj\M|^oj$|na casa|na cas$|chegou na residencia|ja esta no local|vizinho do cliente|^agenda livre$', 'Encaixe na agenda'),
    ('service_order_reschedule', 34, '\mapos\M|\maopos\M|\mate as\M|\mate meio|meio dia|\mtarde\M|\mmanha\M|primeiros? horario|primeiro da tarde|almoco|\mperiodo\M|\d{1,2}[:h]\d{0,2}|\d{1,2}/\d{1,2}|\m(segunda|terca|quarta|quinta|sexta|sabado|domingo|amanha|feriado|feriao|seg)\M|so pode|so consegue|so esta|so chega|so ira|disponibilidade|nao pode receber|alterar novamente a data|ultimos horarios|\mir as\M|\mdas \d|\mdia \d', 'Cliente sem disponibilidade no horário agendado'),
    ('service_order_reschedule', 35, 'a pedido d?[ao]? ?(cliente|cleinte)|pedido d?[ao]? ?cliente|peddo cliente|cliente (pediu|solicit|reagend|quer|prefere|entrou|ligou|aceitou|confirmou|informou)|solicitacao do cliente|solicitado pelo cliente|soliticitado|opcao do cliente|^do cliente$|esposa do titular|regendou|reagendado com (a|o) cliente|a cliente entrou em contato', 'A pedido do cliente'),
    ('service_order_reschedule', 36, 'consultor', 'A pedido do consultor'),
    ('service_order_reschedule', 37, 'suporte', 'A pedido do suporte'),
    ('service_order_reschedule', 38, 'vendedor|comercial|\mloja\M', 'A pedido do vendedor'),
    ('service_order_close', 39, '^nao foi feit|nao foi feita a internet|esperando a internet|sera feita somente|aguardando retorno|infra disse|verificar no estoque', NULL::text),
    ('service_order_close', 40, 'voalle|voale|outro app', 'Serviço realizado via Voalle'),
    ('service_order_close', 41, 'remota', 'Ativação remota realizada'),
    ('service_order_close', 42, 'sem viabilidade|internet nao pode atender', 'Sem viabilidade técnica'),
    ('service_order_close', 43, 'automaticamente|sistema gerou|duplicada pelo sistema', 'OS gerada automaticamente de forma incorreta'),
    ('service_order_close', 44, 'endereco (estava )?(errado|antigo|incorreto)|endereco sera ajustado|ajuste d[oe] endereco|numero da residencia|n da residencia', 'Endereço incorreto'),
    ('service_order_close', 45, 'titular', 'Troca de titularidade'),
    ('service_order_close', 46, 'cpf errado|contrato errado|outro cnpj|nao tem camera no contrato|em outro nome', 'Contrato incorreto'),
    ('service_order_close', 47, 'nao assinou', 'Cliente não assinou contrato'),
    ('service_order_close', 48, 'cancel\w* (a |da )?mudanca|encerrar a mudanca|nao (vai|ira) mais (se |fazer a )?mud|voltou ao antigo endereco', 'Mudança de endereço cancelada'),
    ('service_order_close', 49, 'de numero \d|esta agendado para o dia', 'Abertura incorreta da OS'),
    ('service_order_close', 50, 'ira (se )?mud|vai (precisar )?(se )?mud|trocar de endereco|ainda nao sabe|data exata|vai agendar outro dia|retorna\w* (o )?(contato|ctt)|daqui|internado|reabert|sera aberta nova|reagendad[oa] para|reagendando para|sera reagendado|nao deseja agendar|ainda nao marcou|quando (tiver|estiver)|nao quer instalar agora|depois eu reagendo', 'Cliente sem data definida'),
    ('service_order_close', 51, 'retencao', 'A pedido da retenção'),
    ('service_order_close', 52, 'nao tem infra|falta de infra|nao temos infraestrutura|infra-?estrutura do local', 'Infraestrutura indisponível'),
    ('service_order_close', 53, 'porta disponivel|problema na cto|reparo de cto', 'Porta ou CTO indisponível'),
    ('service_order_close', 54, 'ampliar a cto|colocar cto|ampliacao de cto|equipe de infra ira|infra ira ate', 'Infraestrutura pendente no local'),
    ('service_order_close', 55, 'fibra (ja existente|no local|na casa)|havia fibra|possui fibra|possuia internet', 'Fibra já existente no local'),
    ('service_order_close', 56, 'ponto de energia', 'Local sem ponto de energia'),
    ('service_order_close', 57, 'online|onlinte|dbm', 'Cliente online'),
    ('service_order_close', 58, 'manualmente', 'OS finalizada manualmente'),
    ('service_order_close', 59, 'erro no sistema|\mbug\M|\mapp\M|aplicativo|offline|\moff$|sgi caiu|poder visualizar|nao (consegue|consegui|cinsegue|esta conseguindo|ta conseguindo)', 'Erro no sistema ou aplicativo'),
    ('service_order_close', 60, 'abertura (incorreta|errada)|erro na abertura|gerada errad|ordem (errada|incorreta)|protocolo errado|^teste|ordem de teste|teste no sistema|desconsider|nao e mudanca|nao era pra passar|nao existe essa|ja criou a o\.?s|ja possui uma ordem|em uma ordem so|problema na o\.?s|duplic', 'Abertura incorreta da OS'),
    ('service_order_close', 61, '\minfra|massivo|backbone|feito pelo suporte|resolvido pelo suporte|ajustou o pc|pessoal da retiradas', 'Atendimento realizado por outro setor'),
    ('service_order_close', 62, '\m(jonathan|joanthan|josue|kaka|gabriel|carlos|alex|gutierre|guri|nidiomar|oseias|albert|thaigo|emerson)\M|outro tecnico', 'Atendimento realizado por outro técnico'),
    ('service_order_close', 63, 'nao deseja mais|nao precisa mais|nao ha mais necessidade|nao (vai )?quer\w* mais|cancelar as cameras|cancelou as cameras|nao caber as cameras', 'Cliente não deseja mais o serviço'),
    ('service_order_close', 64, 'normaliz|voltou|voltaram|retornou|resolvid|resolveu|resulvido|disjuntor|consertad', 'Problema normalizado'),
    ('service_order_close', 65, 'alterou o plano|rever o plano', 'Contrato incorreto'),
    ('service_order_close', 66, 'desist|cancelou a instalacao', 'Cliente desistiu do serviço'),
    ('service_order_close', 67, 'contrato cancelado|cancelamento dessa assinatura|fidelidade em outra empresa|vai cancelar|cliente tirou', 'Cliente cancelou o contrato'),
    ('service_order_close', 68, 'cancel\w* (a )?visita|desmarcar|temos que cancelar|suspender a visita', 'Cliente cancelou a visita'),
    ('service_order_close', 69, 'a pedido d[ao] client|pedido do cliente|solicitado por cliente|cliente (pedindo|pediu|solicitou)', 'A pedido do cliente'),
    ('service_order_close', 70, 'consultor', 'A pedido do consultor'),
    ('service_order_close', 71, 'vendedor|camila', 'A pedido do vendedor'),
    ('service_order_close', 72, 'suporte|hariela', 'A pedido do suporte'),
    ('service_order_close', 73, 'feit+[oa]|realiz|conclu|execut|finaliz|instalad|ja instal|provisionad|retirad|retirou|retirar\M|ativacao normal|readequacao|foi ativo', 'Serviço já realizado'),
    ('service_order_close', 74, 'cliente (cancelou|disse que cancelou|falou para o tecnico que cancelou)|agendamento cancelado', 'Cliente cancelou a visita')
),
textos AS (
  SELECT so.id, t.tipo, t.texto, regexp_replace(translate(lower(btrim(t.texto)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') AS n
  FROM public.service_orders so
  CROSS JOIN LATERAL (VALUES
      ('service_order_unproductive', so.unproductive_reason),
      ('service_order_reschedule', so.rescheduling_reason),
      ('service_order_close', so.closing_reason)) AS t (tipo, texto)
  WHERE nullif(btrim(t.texto), '') IS NOT NULL
)
SELECT DISTINCT ON (x.id, x.tipo) x.id, x.tipo, x.texto, d.label
FROM textos x
LEFT JOIN de_para d ON d.tipo = x.tipo AND x.n ~ d.padrao
ORDER BY x.id, x.tipo, d.prioridade;

-- 2) Conferências ANTES de gravar.
-- 2a) Motivos usados pela conversão que NÃO existem na reasons de produção.
--     TEM QUE VOLTAR VAZIO; se voltar algo, o nome mudou e a linha não converteria.
SELECT DISTINCT m.tipo, m.label
FROM motivos_convertidos m
WHERE m.label IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.reasons r
                  WHERE r.type = m.tipo AND r.label = m.label AND r.deleted_at IS NULL)
ORDER BY 1, 2;

-- 2b) Prévia: quantas OS por motivo (label vazio = fica sem id).
SELECT tipo, coalesce(label, '(sem conversão)') AS motivo, count(*) AS os
FROM motivos_convertidos
GROUP BY 1, 2
ORDER BY 1, 3 DESC;

-- 2c) Prévia detalhada: cada texto antigo e o motivo escolhido.
SELECT tipo, lower(btrim(texto)) AS texto_antigo, coalesce(label, '(sem conversão)') AS motivo, count(*) AS os
FROM motivos_convertidos
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC, 2;

-- 3) Gravação (rodar dentro de BEGIN; ... COMMIT; se preferir conferir antes).
UPDATE public.service_orders so
   SET unproductive_reason_id = r.id
  FROM motivos_convertidos m
  JOIN public.reasons r ON r.type = m.tipo AND r.label = m.label AND r.deleted_at IS NULL
 WHERE m.id = so.id
   AND m.tipo = 'service_order_unproductive'
   AND so.unproductive_reason_id IS NULL;

UPDATE public.service_orders so
   SET rescheduling_reason_id = r.id
  FROM motivos_convertidos m
  JOIN public.reasons r ON r.type = m.tipo AND r.label = m.label AND r.deleted_at IS NULL
 WHERE m.id = so.id
   AND m.tipo = 'service_order_reschedule'
   AND so.rescheduling_reason_id IS NULL;

UPDATE public.service_orders so
   SET closing_reason_id = r.id
  FROM motivos_convertidos m
  JOIN public.reasons r ON r.type = m.tipo AND r.label = m.label AND r.deleted_at IS NULL
 WHERE m.id = so.id
   AND m.tipo = 'service_order_close'
   AND so.closing_reason_id IS NULL;

-- 4) Conferência final: OS com texto antigo que ficaram sem id, por coluna.
SELECT
  count(*) FILTER (WHERE nullif(btrim(unproductive_reason), '') IS NOT NULL AND unproductive_reason_id IS NULL) AS improdutiva_sem_id,
  count(*) FILTER (WHERE nullif(btrim(rescheduling_reason), '') IS NOT NULL AND rescheduling_reason_id IS NULL) AS reagendamento_sem_id,
  count(*) FILTER (WHERE nullif(btrim(closing_reason), '') IS NOT NULL AND closing_reason_id IS NULL) AS encerramento_sem_id
FROM public.service_orders;
