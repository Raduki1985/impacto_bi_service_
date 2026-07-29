import { initials } from '../lib/formatters'
import type { Permission, User } from './dashboardTypes'
import { biAreas } from '../config/biAreas'
import {
  defaultDepartmentPageKeys,
  departmentIdFromLabel,
  deriveUserAccess,
  type UserAccessConfig,
} from '../lib/userAccessRules'

/** Todos os departamentos do portal, na ordem de exibição do catálogo. */
const ALL_DEPARTMENTS = biAreas.map((area) => area.label)

type Profile = User['profile']

/**
 * Configuração de acesso inicial de cada perfil, entregue à regra única de
 * derivação. Administrador e Executivo não declaram departamentos nem páginas,
 * porque são fixos: o Administrador tem acesso global e recebe todas as
 * páginas, inclusive o Modelo, e o Executivo recebe todas as páginas comuns de
 * todos os departamentos, sem o Modelo por padrão. O Usuário Departamental
 * recebe as páginas padrão de cada departamento vinculado, ou seja, todas menos
 * o Modelo. Em todos os perfis as páginas em desenvolvimento fazem parte do
 * padrão.
 *
 * Sem fallback silencioso: um seed fora do catálogo precisa quebrar a geração
 * dos mocks.
 */
function accessConfig(profile: Profile, departments: readonly string[]): UserAccessConfig {
  if (profile === 'Administrador') return { profile }
  if (profile === 'Executivo') return { profile }

  return {
    profile,
    departments: departments.map((name) => {
      const departmentId = departmentIdFromLabel(name)

      if (!departmentId) {
        throw new Error(`Departamento não encontrado para o usuário mockado: ${name}`)
      }

      return { departmentId, pageKeys: defaultDepartmentPageKeys(departmentId) }
    }),
  }
}

const seedUsers: { id: string; name: string; email: string; profile: Profile; departments: string[]; lastAccess: string }[] = [
  { id: 'usr-001', name: 'Mário Luiz Ramos', email: 'marioramos@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '24/07/2026 08:42' },
  { id: 'usr-002', name: 'Vagner Santos', email: 'vagnersantos@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '24/07/2026 08:10' },
  { id: 'usr-003', name: 'Tatiane Souza Oliveira Vasconcelos', email: 'tatianesouza@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '23/07/2026 16:35' },
  { id: 'usr-004', name: 'Alexandre Imai', email: 'alexandreimai@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '23/07/2026 09:20' },
  { id: 'usr-005', name: 'Fernando Andrade', email: 'fernando.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '22/07/2026 14:05' },
  { id: 'usr-006', name: 'Henrique Andrade', email: 'henrique.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '21/07/2026 17:12' },
  { id: 'usr-007', name: 'Rodrigo Andrade', email: 'rodrigo.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '21/07/2026 08:55' },
  { id: 'usr-008', name: 'Albert Vinicius Rodrigues', email: 'albertvinicius@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Ordens de Serviço', 'Suporte Técnico', 'COP', 'Auditoria Técnica', 'Gestão de Frota'], lastAccess: '20/07/2026 15:40' },
  { id: 'usr-009', name: 'Josué Fernando da Silva', email: 'josuefernando@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Ordens de Serviço'], lastAccess: '18/07/2026 10:18' },
  { id: 'usr-010', name: 'Caique Andrade Ferro', email: 'caiqueferro@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Ordens de Serviço'], lastAccess: '17/07/2026 13:47' },
  { id: 'usr-011', name: 'Emerson Ribeiro dos Santos', email: 'emersonsantos@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Comercial'], lastAccess: '16/07/2026 11:30' },
  { id: 'usr-012', name: 'Rafael da Silva', email: 'rafaelsilva@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Comercial'], lastAccess: '15/07/2026 16:22' },
  { id: 'usr-013', name: 'Tayane Caroline de Almeida Quintiliano', email: 'tayanequintiliano@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Suporte Técnico'], lastAccess: '14/07/2026 09:12' },
  { id: 'usr-014', name: 'Joelma Maria da Cruz', email: 'joelmacruz@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Cobrança', 'Fidelização', 'Retenção', 'Retiradas'], lastAccess: '11/07/2026 14:48' },
  { id: 'usr-015', name: 'Maria Angélica de Souza', email: 'angelicasouza@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Cobrança', 'Fidelização', 'Retenção'], lastAccess: '10/07/2026 08:36' },
  { id: 'usr-016', name: 'Talita de Aquino Araújo', email: 'talitaaquino@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Retiradas'], lastAccess: '08/07/2026 17:05' },
  { id: 'usr-017', name: 'Ricardo Daniel da Silva', email: 'ricardodaniel@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Auditoria Técnica'], lastAccess: '07/07/2026 10:40' },
  { id: 'usr-018', name: 'Maria Lucia de Andrade Bueno', email: 'marialucia@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Gestão de Frota'], lastAccess: '04/07/2026 13:15' },
  { id: 'usr-019', name: 'Filipe Fernando Ribeiro', email: 'filipefernando@impactotelecom.com', profile: 'Usuário Departamental', departments: ['Experiência do Cliente'], lastAccess: '01/07/2026 09:05' },
]

export const users: User[] = seedUsers.map((user) => {
  const access = deriveUserAccess(accessConfig(user.profile, user.departments))

  if (!access) {
    throw new Error(`Acesso inválido para o usuário mockado: ${user.name}`)
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...access,
    status: 'Ativo',
    lastAccess: user.lastAccess,
    initials: initials(user.name),
  }
})

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
