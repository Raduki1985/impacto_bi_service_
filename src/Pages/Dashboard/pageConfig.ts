import {
  BarChart3,
  CalendarDays,
  CheckCheck,
  Database,
  LayoutDashboard,
  LineChart,
  Sparkles,
  Tags,
  Users,
  XCircle,
} from 'lucide-react'

export type PageKey =
  | 'overview'
  | 'temporal'
  | 'calendar'
  | 'status'
  | 'categories'
  | 'resolutions'
  | 'unproductive'
  | 'closing'
  | 'technicians'
  | 'customers'
  | 'quality'
  | 'intelligence'
  | 'model'
  | 'users'
  | 'history'

export const pageTitles: Record<PageKey, [string, string]> = {
  overview: ['Visão Geral', 'Indicadores executivos da operação de campo'],
  temporal: ['Evolução Temporal', 'Séries diária, semanal e mensal das ordens de serviço'],
  calendar: ['Calendário Operacional', 'Intensidade de demanda por dia, picos e dias críticos'],
  status: ['Status das Ordens', 'Distribuição e composição por situação'],
  categories: ['Categorias', 'Volume, participação e cruzamentos por categoria'],
  resolutions: ['Resoluções', 'Desfechos das ordens concluídas'],
  unproductive: ['Improdutividade', 'Motivos, técnicos, categorias e evolução das OS improdutivas'],
  closing: ['Motivos de Fechamento', 'Análise das OS fechadas e canceladas'],
  technicians: ['Técnicos & Ranking', 'Produtividade, taxa de conclusão e heatmaps de atuação'],
  customers: ['Clientes', 'Reincidência e clientes com mais chamados'],
  quality: ['Qualidade & Cruzamentos', 'Matrizes de calor entre as dimensões'],
  intelligence: ['Inteligência sobre Observações', 'Classificação automática das anotações dos técnicos'],
  model: ['Modelo Dimensional', 'Star schema, dimensões e indicadores calculados'],
  users: ['Usuários', 'Cadastro de acessos ao BI e vínculo de permissões'],
  history: ['Histórico', 'Registro das alterações realizadas nos usuários do portal'],
}

export const pageSlugs: Record<PageKey, string> = {
  overview: 'visao-geral',
  temporal: 'temporal',
  calendar: 'calendario',
  status: 'status',
  categories: 'categorias',
  resolutions: 'resolucoes',
  unproductive: 'improdutividade',
  closing: 'fechamento',
  technicians: 'tecnicos',
  customers: 'clientes',
  quality: 'qualidade',
  intelligence: 'inteligencia',
  model: 'modelo',
  users: 'usuarios',
  history: 'historico',
}

export function pageFromSlug(slug?: string): PageKey | null {
  if (!slug) return null

  const match = Object.entries(pageSlugs).find(([, value]) => value === slug)

  return match ? (match[0] as PageKey) : null
}

export const navigationGroups = [
  {
    label: 'Geral',
    items: [
      { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
      { key: 'temporal', label: 'Evolução Temporal', icon: LineChart },
      { key: 'calendar', label: 'Calendário', icon: CalendarDays },
    ],
  },
  {
    label: 'Operação',
    items: [
      { key: 'status', label: 'Status', icon: BarChart3 },
      { key: 'categories', label: 'Categorias', icon: Tags },
      { key: 'resolutions', label: 'Resoluções', icon: CheckCheck },
      { key: 'unproductive', label: 'Improdutividade', icon: XCircle },
      { key: 'closing', label: 'Fechamento', icon: XCircle },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { key: 'technicians', label: 'Técnicos', icon: Users },
      { key: 'customers', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Análise',
    items: [
      { key: 'quality', label: 'Qualidade', icon: BarChart3 },
      { key: 'intelligence', label: 'Inteligência (IA)', icon: Sparkles },
      { key: 'model', label: 'Modelo Dimensional', icon: Database },
    ],
  },
] as const
