import {
  BarChart3,
  CalendarDays,
  CheckCheck,
  Database,
  LayoutDashboard,
  LineChart,
  MessageSquareText,
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
  | 'permissions'

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
  permissions: ['Permissões', 'Acessos aos painéis que podem ser vinculados aos usuários'],
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
      { key: 'intelligence', label: 'Inteligência (IA)', icon: MessageSquareText },
      { key: 'model', label: 'Modelo', icon: Database },
    ],
  },
] as const
