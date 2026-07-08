import { initials } from '../lib/formatters'
import type { Permission, User } from './dashboardTypes'

export const users: User[] = [
  ['Carla Mendes', 'carla.mendes@provedor.com.br', 'Administrador', 'Todos os acessos', 'Ativo', 'há 5 min'],
  ['Rafael Souza', 'rafael.souza@provedor.com.br', 'Analista', 'Visão Executiva, Operação +1', 'Ativo', 'há 2 h'],
  ['Anderson Gomes', 'anderson.gomes@provedor.com.br', 'Analista', 'Gestão de Técnicos, Improdutividade', 'Ativo', 'ontem'],
  ['Juliana Prado', 'juliana.prado@provedor.com.br', 'Visualizador', 'Visão Executiva', 'Ativo', 'há 3 dias'],
  ['Marcos Oliveira', 'marcos.oliveira@provedor.com.br', 'Administrador', 'Todos os acessos', 'Ativo', 'há 1 h'],
  ['Patrícia Lima', 'patricia.lima@provedor.com.br', 'Visualizador', 'Clientes & Qualidade', 'Inativo', 'há 1 mês'],
  ['Bruno Nogueira', 'bruno.nogueira@provedor.com.br', 'Analista', 'Operação, Improdutividade', 'Ativo', 'há 20 min'],
  ['Fernanda Castro', 'fernanda.castro@provedor.com.br', 'Analista', 'Visão Executiva, Clientes & Qualidade', 'Ativo', 'há 45 min'],
  ['Diego Barbosa', 'diego.barbosa@provedor.com.br', 'Visualizador', 'Operação', 'Ativo', 'há 4 h'],
  ['Larissa Freitas', 'larissa.freitas@provedor.com.br', 'Analista', 'Gestão de Técnicos', 'Ativo', 'ontem'],
  ['Willian Fernandes', 'willian.fernandes@provedor.com.br', 'Visualizador', 'Visão Executiva', 'Inativo', 'há 2 semanas'],
  ['Camila Araujo', 'camila.araujo@provedor.com.br', 'Analista', 'Improdutividade, Operação', 'Ativo', 'há 1 h'],
  ['Gustavo Pinto', 'gustavo.pinto@provedor.com.br', 'Administrador', 'Todos os acessos', 'Ativo', 'há 3 h'],
  ['Beatriz Cardoso', 'beatriz.cardoso@provedor.com.br', 'Visualizador', 'Clientes & Qualidade', 'Ativo', 'há 6 dias'],
  ['Rodrigo Moraes', 'rodrigo.moraes@provedor.com.br', 'Analista', 'Visão Executiva, Operação', 'Ativo', 'há 30 min'],
  ['Vanessa Dias', 'vanessa.dias@provedor.com.br', 'Visualizador', 'Inteligência (IA)', 'Inativo', 'há 1 mês'],
  ['Samuel Ribeiro', 'samuel.ribeiro@provedor.com.br', 'Analista', 'Gestão de Técnicos, Improdutividade', 'Ativo', 'ontem'],
  ['Aline Teixeira', 'aline.teixeira@provedor.com.br', 'Analista', 'Operação, Clientes & Qualidade', 'Ativo', 'há 2 h'],
  ['Sergio Almeida', 'sergio.almeida@provedor.com.br', 'Visualizador', 'Visão Executiva', 'Ativo', 'há 5 dias'],
  ['Renata Nunes', 'renata.nunes@provedor.com.br', 'Administrador', 'Todos os acessos', 'Ativo', 'há 15 min'],
  ['Felipe Rocha', 'felipe.rocha@provedor.com.br', 'Analista', 'Improdutividade', 'Ativo', 'há 3 h'],
  ['Tatiana Gomes', 'tatiana.gomes@provedor.com.br', 'Visualizador', 'Clientes & Qualidade', 'Inativo', 'há 3 semanas'],
  ['Vitor Cardoso', 'vitor.cardoso@provedor.com.br', 'Analista', 'Visão Executiva, Operação +1', 'Ativo', 'há 1 dia'],
].map(([name, email, profile, permissions, status, lastAccess]) => ({
  name,
  email,
  profile,
  permissions,
  status,
  lastAccess,
  initials: initials(name),
})) as User[]

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
    name: 'Administração',
    key: 'admin.full',
    description: 'Gestão de usuários e permissões do sistema.',
    screens: ['Usuários', 'Permissões'],
    users: 2,
  },
].map((permission, index) => ({
  ...permission,
  color: permissionColors[index % permissionColors.length],
}))

export const biScreens = [
  'Visão Geral',
  'Evolução Temporal',
  'Calendário Operacional',
  'Status das Ordens',
  'Categorias',
  'Resoluções',
  'Improdutividade',
  'Motivos de Fechamento',
  'Técnicos & Ranking',
  'Clientes',
  'Qualidade & Cruzamentos',
  'Inteligência (IA)',
  'Modelo Dimensional',
  'Usuários',
  'Permissões',
]
