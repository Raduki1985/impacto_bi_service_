/**
 * Catálogos de Ordens de Serviço aprovados a partir da investigação do SGI de
 * 21/08/2026.
 *
 * Este arquivo separa FATO de SIMULAÇÃO:
 *
 * - São fatos aprovados: as seis equipes analíticas, os 43 técnicos
 *   classificados (nome exibido no SGI + equipe), os catálogos normalizados de
 *   Tipo de OS, Cidade, Status e Resolução, e os totais agregados do período
 *   01/08/2026 a 21/08/2026.
 * - É simulação: TODA associação individual entre técnico, OS, cliente,
 *   produtividade e improdutividade, gerada em `mockOsData.ts`.
 *
 * O identificador dos técnicos é LOCAL e OPACO (`mock-tech-NNN`), criado só
 * para esta base mockada. Ele não é o identificador oficial do SGI: dados
 * pessoais dos cadastros (como e-mails) não entram no código do front-end nem
 * no bundle servido ao navegador.
 */

/** As seis equipes analíticas oficiais. Não existe "Sem equipe" no catálogo. */
export const OS_TEAMS = [
  'Infra',
  'Terceirizada',
  'Câmeras',
  'Suporte Técnico',
  'Suporte Lógico',
  'Retiradas',
] as const

export type OsTeam = (typeof OS_TEAMS)[number]

/** Tipo de OS normalizado. Dimensão distinta de Categoria. */
export const OS_SERVICE_TYPES = [
  'Instalação',
  'Infraestrutura',
  'Manutenção',
  'Retirada',
  'Mudança de Endereço',
  'Auditoria',
  'Instalação de Câmeras',
] as const

export type OsServiceType = (typeof OS_SERVICE_TYPES)[number]

/** Cidades normalizadas, sem duplicidade por caixa. */
export const OS_CITIES = [
  'Atibaia',
  'Bom Jesus dos Perdões',
  'Bragança Paulista',
  'Campinas',
  'Jarinu',
  'Joanópolis',
  'Mairiporã',
  'Nazaré Paulista',
  'Piracaia',
  'São Paulo',
  'Terra Preta',
] as const

export type OsCity = (typeof OS_CITIES)[number]

/**
 * Status normalizados, na ordem operacional. Nenhum valor cru do SGI
 * (`in_progress`, `cancelled`, `Checklist`, `Chegou`) chega à interface, e
 * `Fechada` foi substituída por `Encerrada`.
 */
export const OS_STATUSES = [
  'Pendente',
  'Agendada',
  'Reagendada',
  'Em Deslocamento',
  'Técnico no Local',
  'Em Andamento',
  'Pendente de Aprovação',
  'Concluída',
  'Cancelada',
  'Improdutiva',
  'Encerrada',
  'Expirada',
  'Provisionamento',
] as const

export type OrderStatus = (typeof OS_STATUSES)[number]

/** Resoluções normalizadas: sem duplicata de caixa e sem o typo "Spliter". */
export const OS_RESOLUTIONS = [
  'Fibra Quebrada',
  'Cabo Rompido',
  'Splitter',
  'Problema na Rede',
  'Cabo Dobrado',
  'Troca de Poste',
  'Poda',
  'Fusão Quebrada',
  'Cabo Queimado',
  'Readequação da CTO',
  'Ampliado para 1x8',
  'Ampliado para 1x16',
  'Atenuação da Rede',
  'Rede Mal Projetada',
  'Projeto Finalizado',
  'Continuar Projeto',
  'Continuar Link',
  'Link Finalizado',
  'Expansão Finalizada',
  'Instalação Realizada',
  'Todas as Câmeras Instaladas',
  'Instalação + Segundo Ponto Executado',
  'Instalação Parcial das Câmeras, Retornar ao Local',
  'Troca de Câmeras',
  'Reparo Realizado com Sucesso',
  'Projeto Pausado por Tempo',
  'Projeto Pausado por Outra Urgência',
  'Manutenção Realizada com Sucesso',
  'Não Realizado, Local sem Viabilidade',
] as const

export type OsResolution = (typeof OS_RESOLUTIONS)[number]

export type OsTechnician = {
  /**
   * Identificador LOCAL e opaco da base mockada (`mock-tech-NNN`). Não é o
   * identificador oficial do SGI e nunca é exibido na interface; serve apenas
   * como chave estável entre catálogo, OS e agregados.
   */
  id: string
  /** Nome exibido no SGI, usado nas OS e nos rankings. */
  name: string
  team: OsTeam
  /**
   * `false` para inativos e ex-funcionários: permanecem classificados no
   * catálogo para eventual histórico, mas não recebem OS do período atual.
   * Nenhuma data de admissão ou desligamento foi inventada.
   */
  activeInCurrentPeriod: boolean
}

/**
 * Os 43 técnicos classificados nas seis equipes aprovadas.
 *
 * João Yoneyama foi excluído por ser um perfil DEV de teste; ele não é Josué
 * Fernando da Silva, que é supervisor e não executor. Emerson Wesley (Emerson
 * Wesley Rezende da Silva) e Henrique Campos (Henrique Campos Ferraz) são uma
 * pessoa cada, sem registro duplicado.
 */
export const OS_TECHNICIANS: OsTechnician[] = [
  // Câmeras
  { id: 'mock-tech-001', name: 'Acacio Mendes de Souza', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-002', name: 'Alessandro Lopes Celestino', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-003', name: 'Anselmo Pinheiro', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-004', name: 'Bruno França Honorato da Silva', team: 'Câmeras', activeInCurrentPeriod: false },
  { id: 'mock-tech-005', name: 'Carlos Alberto Ferreira', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-006', name: 'Davi da rocha Viriato', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-007', name: 'Isael França Pereira', team: 'Câmeras', activeInCurrentPeriod: false },
  { id: 'mock-tech-008', name: 'Leonardo Cesar Neto', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-009', name: 'Nildiomar Dias dos Santos', team: 'Câmeras', activeInCurrentPeriod: true },
  { id: 'mock-tech-010', name: 'Wagner Wilson da Silva', team: 'Câmeras', activeInCurrentPeriod: true },
  // Infra
  { id: 'mock-tech-011', name: 'Emerson Wesley', team: 'Infra', activeInCurrentPeriod: true },
  { id: 'mock-tech-012', name: 'Fabio Paiva', team: 'Infra', activeInCurrentPeriod: true },
  { id: 'mock-tech-013', name: 'Henrique Campos', team: 'Infra', activeInCurrentPeriod: true },
  { id: 'mock-tech-014', name: 'Jonathan Felipe Soares Souza', team: 'Infra', activeInCurrentPeriod: true },
  { id: 'mock-tech-015', name: 'Wesley Alexandre', team: 'Infra', activeInCurrentPeriod: true },
  // Terceirizada
  { id: 'mock-tech-016', name: 'Antonio Francisco Pereira Neto', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-017', name: 'Daniel Aparecido de Oliveira Junior', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-018', name: 'Felipe de Moura', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-019', name: 'Fernando Henrique Leite Pereira', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-020', name: 'Francisco Fabio Bernardo', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-021', name: 'Gabriel da Silva Santos', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-022', name: 'Jailson Ribeiro dos Santos Paixão', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-023', name: 'Jefferson Leal de Oliveira Sampaio', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-024', name: 'Kelvis Leite Canuto da Silva', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-025', name: 'Luis Guilherme Serafim', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-026', name: 'Marcos Antonio Alves de Oliveira', team: 'Terceirizada', activeInCurrentPeriod: true },
  { id: 'mock-tech-027', name: 'Thiago Andre Santana Teixeira', team: 'Terceirizada', activeInCurrentPeriod: true },
  // Suporte Técnico
  { id: 'mock-tech-028', name: 'Alex Conceicao dos Santos', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-029', name: 'Alex Rodrigues Oliveira da Silva', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-030', name: 'Gabriel Silva de Moraes', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-031', name: 'Genivaldo Alves Galdino Junior', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-032', name: 'Gutierre Felipe de Oliveira Silva', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-033', name: 'Jonathan Fabiano Rocha de Oliveira', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-034', name: 'Jose Lucas da Paixao Pereira', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-035', name: 'Luciano Barbosa da Silva', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-036', name: 'Patrick Cesario Gonçalves', team: 'Suporte Técnico', activeInCurrentPeriod: true },
  { id: 'mock-tech-037', name: 'Patrick Fernandes Franco', team: 'Suporte Técnico', activeInCurrentPeriod: false },
  { id: 'mock-tech-038', name: 'Rafael Carneiro Alves', team: 'Suporte Técnico', activeInCurrentPeriod: false },
  // Suporte Lógico
  { id: 'mock-tech-039', name: 'Dener Mendes', team: 'Suporte Lógico', activeInCurrentPeriod: true },
  { id: 'mock-tech-040', name: 'Felipe de Queiroz Homem', team: 'Suporte Lógico', activeInCurrentPeriod: true },
  // Retiradas
  { id: 'mock-tech-041', name: 'Anderson Cardoso Magalhaes', team: 'Retiradas', activeInCurrentPeriod: true },
  { id: 'mock-tech-042', name: 'Gabriel Pereira Carvalho', team: 'Retiradas', activeInCurrentPeriod: true },
  { id: 'mock-tech-043', name: 'Renan Rosa dos Santos', team: 'Retiradas', activeInCurrentPeriod: true },
]

/** Técnicos elegíveis para receber OS do período atual. */
export const OS_ACTIVE_TECHNICIANS = OS_TECHNICIANS.filter(
  (technician) => technician.activeInCurrentPeriod,
)

/**
 * Profissionais em fase experimental, já pré-classificados mas ainda SEM
 * identificador no SGI. Registro apenas informativo: eles não recebem OS
 * mockadas, não aparecem em rankings nem viram opção de filtro, e nenhum
 * identificador foi inventado para eles.
 */
export const OS_EXPERIMENTAL_PROFESSIONALS: ReadonlyArray<{ name: string; team: OsTeam }> = [
  { name: 'Ademir Francisco Bento Junior', team: 'Suporte Técnico' },
  { name: 'Eberson Francisley Cardoso', team: 'Suporte Técnico' },
  { name: 'Isaias de Oliveira Assis Neto', team: 'Suporte Técnico' },
  { name: 'Eric Dalmora Machado', team: 'Retiradas' },
  { name: 'William Souza Silva', team: 'Infra' },
]

/** Data da investigação do SGI que originou os catálogos e os agregados. */
export const OS_DATA_UPDATED_AT = '21/08/2026'

/** Janela padrão da base mockada, a mesma do Relatório de OS consultado. */
export const OS_PERIOD = { start: '2026-08-01', end: '2026-08-21' } as const

/** Identificação visual obrigatória da base simulada. */
export const OS_SIMULATED_BADGE = 'Dados simulados'
export const OS_SIMULATED_EXPLANATION =
  'Equipes e catálogos baseados na investigação do SGI de 21/08/2026. OS, clientes e desempenho por técnico são simulados.'
