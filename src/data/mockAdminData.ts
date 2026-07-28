import { initials } from '../lib/formatters'
import type { Permission, User } from './dashboardTypes'
import type { DepartmentPageAccess } from '../types/access'
import { biAreas, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import {
  ADMIN_FULL_PERMISSION,
  ADMIN_USERS_READ_PERMISSION,
  ORDERS_SERVICE_ACCESS_PERMISSION,
} from '../config/permissions'
import { BILLING_ACCESS_PERMISSION } from '../Pages/Billing/pageConfig'
import { COMMERCIAL_ACCESS_PERMISSION } from '../Pages/Commercial/pageConfig'
import { COP_ACCESS_PERMISSION } from '../Pages/Cop/pageConfig'
import { CUSTOMER_EXPERIENCE_ACCESS_PERMISSION } from '../Pages/CustomerExperience/pageConfig'
import { EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION } from '../Pages/EquipmentRetrieval/pageConfig'
import { FLEET_MANAGEMENT_ACCESS_PERMISSION } from '../Pages/FleetManagement/pageConfig'
import { LOYALTY_ACCESS_PERMISSION } from '../Pages/Loyalty/pageConfig'
import { RETENTION_ACCESS_PERMISSION } from '../Pages/Retention/pageConfig'
import { TECHNICAL_AUDIT_ACCESS_PERMISSION } from '../Pages/TechnicalAudit/pageConfig'
import { TECHNICAL_SUPPORT_ACCESS_PERMISSION } from '../Pages/TechnicalSupport/pageConfig'

/** Lista completa de departamentos do portal, em ordem alfabética de exibição. */
const ALL_DEPARTMENTS = [
  'Auditoria Técnica',
  'Cobrança',
  'Comercial',
  'COP',
  'Experiência do Cliente',
  'Fidelização',
  'Gestão de Frota',
  'Ordens de Serviço',
  'Retenção',
  'Retiradas',
  'Suporte Técnico',
] as const

/** Mapa entre o nome de exibição do departamento e sua chave técnica de acesso. */
const departmentPermissionByName: Record<string, string> = {
  'Auditoria Técnica': TECHNICAL_AUDIT_ACCESS_PERMISSION,
  'Cobrança': BILLING_ACCESS_PERMISSION,
  'Comercial': COMMERCIAL_ACCESS_PERMISSION,
  'COP': COP_ACCESS_PERMISSION,
  'Experiência do Cliente': CUSTOMER_EXPERIENCE_ACCESS_PERMISSION,
  'Fidelização': LOYALTY_ACCESS_PERMISSION,
  'Gestão de Frota': FLEET_MANAGEMENT_ACCESS_PERMISSION,
  'Ordens de Serviço': ORDERS_SERVICE_ACCESS_PERMISSION,
  'Retenção': RETENTION_ACCESS_PERMISSION,
  'Retiradas': EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION,
  'Suporte Técnico': TECHNICAL_SUPPORT_ACCESS_PERMISSION,
}

/** Mapa entre o nome de exibição do departamento e seu id técnico, derivado das áreas do portal. */
const departmentIdByName = new Map<string, BiAreaId>(
  biAreas.map(({ id, label }) => [label, id]),
)

/** Sem fallback silencioso: um seed fora do catálogo precisa quebrar a geração dos mocks. */
function departmentIdFromName(name: string): BiAreaId {
  const departmentId = departmentIdByName.get(name)

  if (!departmentId) {
    throw new Error(`Departamento não encontrado para o usuário mockado: ${name}`)
  }

  return departmentId
}

type Profile = User['profile']

/**
 * Gera as chaves técnicas de permissão conforme o perfil, sem duplicatas:
 * Administrador → admin.full (acesso global); Executivo → todas as permissões
 * departamentais + leitura de usuários; Gestor → apenas os departamentos
 * vinculados.
 */
function buildPermissionKeys(profile: Profile, departments: string[]): string[] {
  if (profile === 'Administrador') return [ADMIN_FULL_PERMISSION]

  const keys = new Set<string>()

  if (profile === 'Executivo') {
    for (const key of Object.values(departmentPermissionByName)) keys.add(key)
    keys.add(ADMIN_USERS_READ_PERMISSION)
    return [...keys]
  }

  for (const department of departments) {
    const key = departmentPermissionByName[department]
    if (key) keys.add(key)
  }

  return [...keys]
}

/** Texto de permissões exibido na tabela, conforme o perfil. */
function buildPermissionsText(profile: Profile, departments: string[]): string {
  if (profile === 'Administrador') return 'Todos os acessos'
  if (profile === 'Executivo') return 'Todos os departamentos, Usuários (leitura)'
  return departments.join(', ')
}

const OVERVIEW_PAGE_KEY = 'overview'
const MODEL_PAGE_KEY = 'model'

/**
 * Acesso inicial por departamento e página, sempre a partir do catálogo em
 * `departmentPages`: Administrador recebe todas as páginas, inclusive as em
 * desenvolvimento e o Modelo; Executivo recebe as páginas prontas de todos os
 * departamentos, exceto o Modelo; Gestor recebe apenas a Visão Geral dos
 * departamentos já vinculados.
 */
function buildDepartmentPageAccess(
  profile: Profile,
  departments: string[],
): DepartmentPageAccess[] {
  if (profile === 'Administrador') {
    return biAreas.map(({ id }) => ({
      departmentId: id,
      pageKeys: departmentPages[id].map((page) => page.key),
    }))
  }

  if (profile === 'Executivo') {
    return biAreas.map(({ id }) => ({
      departmentId: id,
      pageKeys: departmentPages[id]
        .filter((page) => !page.disabled && page.key !== MODEL_PAGE_KEY)
        .map((page) => page.key),
    }))
  }

  return departments.map((name) => {
    const departmentId = departmentIdFromName(name)
    const hasOverview = departmentPages[departmentId].some(
      (page) => page.key === OVERVIEW_PAGE_KEY,
    )

    if (!hasOverview) {
      throw new Error(`Departamento sem página de Visão Geral no catálogo: ${name}`)
    }

    return { departmentId, pageKeys: [OVERVIEW_PAGE_KEY] }
  })
}

const seedUsers: { id: string; name: string; email: string; profile: Profile; departments: string[]; lastAccess: string }[] = [
  { id: 'usr-001', name: 'Mário Luiz Ramos', email: 'marioramos@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '24/07/2026 08:42' },
  { id: 'usr-002', name: 'Vagner Santos', email: 'vagnersantos@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '24/07/2026 08:10' },
  { id: 'usr-003', name: 'Tatiane Souza Oliveira Vasconcelos', email: 'tatianesouza@impactotelecom.com', profile: 'Administrador', departments: [...ALL_DEPARTMENTS], lastAccess: '23/07/2026 16:35' },
  { id: 'usr-004', name: 'Alexandre Imai', email: 'alexandreimai@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '23/07/2026 09:20' },
  { id: 'usr-005', name: 'Fernando Andrade', email: 'fernando.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '22/07/2026 14:05' },
  { id: 'usr-006', name: 'Henrique Andrade', email: 'henrique.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '21/07/2026 17:12' },
  { id: 'usr-007', name: 'Rodrigo Andrade', email: 'rodrigo.andrade@impactotelecom.com', profile: 'Executivo', departments: [...ALL_DEPARTMENTS], lastAccess: '21/07/2026 08:55' },
  { id: 'usr-008', name: 'Albert Vinicius Rodrigues', email: 'albertvinicius@impactotelecom.com', profile: 'Gestor', departments: ['Ordens de Serviço', 'Suporte Técnico', 'COP', 'Auditoria Técnica', 'Gestão de Frota'], lastAccess: '20/07/2026 15:40' },
  { id: 'usr-009', name: 'Josué Fernando da Silva', email: 'josuefernando@impactotelecom.com', profile: 'Gestor', departments: ['Ordens de Serviço'], lastAccess: '18/07/2026 10:18' },
  { id: 'usr-010', name: 'Caique Andrade Ferro', email: 'caiqueferro@impactotelecom.com', profile: 'Gestor', departments: ['Ordens de Serviço'], lastAccess: '17/07/2026 13:47' },
  { id: 'usr-011', name: 'Emerson Ribeiro dos Santos', email: 'emersonsantos@impactotelecom.com', profile: 'Gestor', departments: ['Comercial'], lastAccess: '16/07/2026 11:30' },
  { id: 'usr-012', name: 'Rafael da Silva', email: 'rafaelsilva@impactotelecom.com', profile: 'Gestor', departments: ['Comercial'], lastAccess: '15/07/2026 16:22' },
  { id: 'usr-013', name: 'Tayane Caroline de Almeida Quintiliano', email: 'tayanequintiliano@impactotelecom.com', profile: 'Gestor', departments: ['Suporte Técnico'], lastAccess: '14/07/2026 09:12' },
  { id: 'usr-014', name: 'Joelma Maria da Cruz', email: 'joelmacruz@impactotelecom.com', profile: 'Gestor', departments: ['Cobrança', 'Fidelização', 'Retenção', 'Retiradas'], lastAccess: '11/07/2026 14:48' },
  { id: 'usr-015', name: 'Maria Angélica de Souza', email: 'angelicasouza@impactotelecom.com', profile: 'Gestor', departments: ['Cobrança', 'Fidelização', 'Retenção'], lastAccess: '10/07/2026 08:36' },
  { id: 'usr-016', name: 'Talita de Aquino Araújo', email: 'talitaaquino@impactotelecom.com', profile: 'Gestor', departments: ['Retiradas'], lastAccess: '08/07/2026 17:05' },
  { id: 'usr-017', name: 'Ricardo Daniel da Silva', email: 'ricardodaniel@impactotelecom.com', profile: 'Gestor', departments: ['Auditoria Técnica'], lastAccess: '07/07/2026 10:40' },
  { id: 'usr-018', name: 'Maria Lucia de Andrade Bueno', email: 'marialucia@impactotelecom.com', profile: 'Gestor', departments: ['Gestão de Frota'], lastAccess: '04/07/2026 13:15' },
  { id: 'usr-019', name: 'Filipe Fernando Ribeiro', email: 'filipefernando@impactotelecom.com', profile: 'Gestor', departments: ['Experiência do Cliente'], lastAccess: '01/07/2026 09:05' },
]

export const users: User[] = seedUsers.map((user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  profile: user.profile,
  permissions: buildPermissionsText(user.profile, user.departments),
  permissionKeys: buildPermissionKeys(user.profile, user.departments),
  departments: user.departments,
  departmentPageAccess: buildDepartmentPageAccess(user.profile, user.departments),
  status: 'Ativo',
  lastAccess: user.lastAccess,
  initials: initials(user.name),
}))

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
