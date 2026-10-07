import type { Permission } from './dashboardTypes'

/**
 * A base mockada de usuários que vivia aqui foi removida: os usuários passaram
 * a vir do `impacto-bi-service`, por `services/users/usersServices`, e nenhum
 * usuário nasce mais no navegador.
 */

const permissionColors = ['#2f6bff', '#00b3a4', '#f5a623', '#e5484d', '#8b5cf6', '#0ea5e9', '#64748b']

export const permissions: Permission[] = [
  {
    name: 'Visão Executiva',
    key: 'bi.executivo',
    description: 'KPIs e visão geral da operação de campo.',
    screens: ['Visão Geral', 'Evolução Temporal', 'Calendário'],
    users: 8,
  },
  {
    name: 'Operação',
    key: 'bi.operacao',
    description: 'Status das ordens, categorias e resoluções.',
    screens: ['Status', 'Categorias', 'Resoluções'],
    users: 6,
  },
  {
    name: 'Gestão de Técnicos',
    key: 'bi.tecnicos',
    description: 'Ranking e desempenho das equipes de campo.',
    screens: ['Técnicos & Ranking'],
    users: 4,
  },
  {
    name: 'Improdutividade',
    key: 'bi.improd',
    description: 'Análise de OS improdutivas e fechamentos.',
    screens: ['Improdutividade', 'Motivos de Fechamento'],
    users: 5,
  },
  {
    name: 'Clientes & Qualidade',
    key: 'bi.qualidade',
    description: 'Reincidência de clientes e cruzamentos.',
    screens: ['Clientes', 'Qualidade'],
    users: 3,
  },
  {
    name: 'Inteligência (IA)',
    key: 'bi.ia',
    description: 'Classificação automática das anotações.',
    screens: ['Inteligência (IA)'],
    users: 2,
  },
  {
    name: 'Comercial',
    key: 'bi.comercial.access',
    description: 'Indicadores executivos da operação comercial.',
    screens: ['Visão Geral (Comercial)'],
    users: 1,
  },
  {
    name: 'Administração',
    key: 'admin.full',
    description: 'Gestão de usuários e histórico de alterações do sistema.',
    screens: ['Usuários', 'Histórico'],
    users: 2,
  },
].map((permission, index) => ({
  ...permission,
  color: permissionColors[index % permissionColors.length],
}))
