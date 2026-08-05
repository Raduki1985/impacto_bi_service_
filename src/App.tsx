import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  CircleDollarSign,
  ClipboardCheck,
  Handshake,
  Headset,
  HeartHandshake,
  MessagesSquare,
  PackageMinus,
  Radar,
  Truck,
  UserRoundCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { DashboardLayout, type PageKey } from './Pages/Dashboard'
import { navigationGroups, pageFromSlug, pageSlugs } from './Pages/Dashboard/pageConfig'
import {
  COMMERCIAL_ACCESS_PERMISSION,
  COMMERCIAL_OVERVIEW_KEY,
  commercialNavigationItems,
  commercialOverviewPath,
  commercialOverviewSubtitle,
  commercialOverviewTitle,
} from './Pages/Commercial/pageConfig'
import {
  TECHNICAL_SUPPORT_ACCESS_PERMISSION,
  TECHNICAL_SUPPORT_OVERVIEW_KEY,
  technicalSupportNavigationItems,
  technicalSupportOverviewPath,
  technicalSupportOverviewSubtitle,
  technicalSupportOverviewTitle,
} from './Pages/TechnicalSupport/pageConfig'
import {
  BILLING_ACCESS_PERMISSION,
  BILLING_OVERVIEW_KEY,
  billingNavigationItems,
  billingOverviewPath,
  billingOverviewSubtitle,
  billingOverviewTitle,
} from './Pages/Billing/pageConfig'
import {
  EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION,
  EQUIPMENT_RETRIEVAL_OVERVIEW_KEY,
  equipmentRetrievalNavigationItems,
  equipmentRetrievalOverviewPath,
  equipmentRetrievalOverviewSubtitle,
  equipmentRetrievalOverviewTitle,
} from './Pages/EquipmentRetrieval/pageConfig'
import {
  LOYALTY_ACCESS_PERMISSION,
  LOYALTY_OVERVIEW_KEY,
  loyaltyNavigationItems,
  loyaltyOverviewPath,
  loyaltyOverviewSubtitle,
  loyaltyOverviewTitle,
} from './Pages/Loyalty/pageConfig'
import {
  RETENTION_ACCESS_PERMISSION,
  RETENTION_OVERVIEW_KEY,
  retentionNavigationItems,
  retentionOverviewPath,
  retentionOverviewSubtitle,
  retentionOverviewTitle,
} from './Pages/Retention/pageConfig'
import {
  COP_ACCESS_PERMISSION,
  COP_OVERVIEW_KEY,
  copNavigationItems,
  copOverviewPath,
  copOverviewSubtitle,
  copOverviewTitle,
} from './Pages/Cop/pageConfig'
import {
  TECHNICAL_AUDIT_ACCESS_PERMISSION,
  TECHNICAL_AUDIT_OVERVIEW_KEY,
  technicalAuditNavigationItems,
  technicalAuditOverviewPath,
  technicalAuditOverviewSubtitle,
  technicalAuditOverviewTitle,
} from './Pages/TechnicalAudit/pageConfig'
import {
  FLEET_MANAGEMENT_ACCESS_PERMISSION,
  FLEET_MANAGEMENT_OVERVIEW_KEY,
  fleetManagementNavigationItems,
  fleetManagementOverviewPath,
  fleetManagementOverviewSubtitle,
  fleetManagementOverviewTitle,
} from './Pages/FleetManagement/pageConfig'
import {
  CUSTOMER_EXPERIENCE_ACCESS_PERMISSION,
  CUSTOMER_EXPERIENCE_OVERVIEW_KEY,
  customerExperienceNavigationItems,
  customerExperienceOverviewPath,
  customerExperienceOverviewSubtitle,
  customerExperienceOverviewTitle,
} from './Pages/CustomerExperience/pageConfig'
import { Login } from './Pages/Login'
import { AuthProvider } from './contexts/AuthContext'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { useAuth } from './contexts/useAuth'
import { usePreferences } from './contexts/usePreferences'
import { DashboardDataProvider } from './contexts/DashboardDataContext'
import { UpcomingDashboard } from './Pages/DepartmentPage'
import { RequirePermission } from './components/routing/RequirePermission'
import { AreaSidebar, type AreaSidebarItem } from './components/navigation/AreaSidebar'
import { getDepartmentPageAccessState } from './lib/accessControl'
import {
  departmentPageKeyFromPath,
  departmentPagePath,
  findDepartmentIdBySlug,
  findDepartmentPageByKey,
  findDepartmentPageBySlug,
} from './lib/departmentPageRoutes'
import {
  resolveHomePath,
  shouldDiscardHomeDepartment,
  usesCorporateHome,
} from './lib/homeNavigation'
import { getAccessibleDepartmentSidebarItems } from './lib/sidebarAccess'
import { resolveSettingsOriginPathname, settingsReturnState } from './lib/settingsNavigation'
import { OVERVIEW_PAGE_KEY } from './lib/userAccessRules'
import { biAreas, getActiveBiArea, type BiArea, type BiAreaId } from './config/biAreas'
import {
  ADMIN_FULL_PERMISSION,
  ADMIN_USERS_READ_PERMISSION,
  ORDERS_SERVICE_ACCESS_PERMISSION,
} from './config/permissions'

const pageComponents: Record<PageKey, React.LazyExoticComponent<ComponentType>> = {
  overview: lazy(() => import('./Pages/Overview').then((module) => ({ default: module.Overview }))),
  temporal: lazy(() => import('./Pages/Temporal').then((module) => ({ default: module.Temporal }))),
  calendar: lazy(() => import('./Pages/OperationalCalendar').then((module) => ({ default: module.OperationalCalendar }))),
  status: lazy(() => import('./Pages/OrderStatus').then((module) => ({ default: module.OrderStatus }))),
  categories: lazy(() => import('./Pages/Categories').then((module) => ({ default: module.Categories }))),
  resolutions: lazy(() => import('./Pages/Resolutions').then((module) => ({ default: module.Resolutions }))),
  unproductive: lazy(() => import('./Pages/Unproductive').then((module) => ({ default: module.Unproductive }))),
  closing: lazy(() => import('./Pages/ClosingReasons').then((module) => ({ default: module.ClosingReasons }))),
  technicians: lazy(() => import('./Pages/Technicians').then((module) => ({ default: module.Technicians }))),
  customers: lazy(() => import('./Pages/Customers').then((module) => ({ default: module.Customers }))),
  quality: lazy(() => import('./Pages/Quality').then((module) => ({ default: module.Quality }))),
  intelligence: lazy(() => import('./Pages/Intelligence').then((module) => ({ default: module.Intelligence }))),
  model: lazy(() => import('./Pages/DimensionalModel').then((module) => ({ default: module.DimensionalModel }))),
  users: lazy(() => import('./Pages/Users').then((module) => ({ default: module.Users }))),
  history: lazy(() =>
    import('./Pages/UserHistory').then((module) => ({
      default: module.UserHistory,
    })),
  ),
}

const CommercialOverview = lazy(() =>
  import('./Pages/Commercial/Overview').then((module) => ({ default: module.Overview })),
)

const TechnicalSupportOverview = lazy(() =>
  import('./Pages/TechnicalSupport/Overview').then((module) => ({ default: module.Overview })),
)

const BillingOverview = lazy(() =>
  import('./Pages/Billing/Overview').then((module) => ({ default: module.Overview })),
)

const EquipmentRetrievalOverview = lazy(() =>
  import('./Pages/EquipmentRetrieval/Overview').then((module) => ({ default: module.Overview })),
)

const LoyaltyOverview = lazy(() =>
  import('./Pages/Loyalty/Overview').then((module) => ({ default: module.Overview })),
)

const RetentionOverview = lazy(() =>
  import('./Pages/Retention/Overview').then((module) => ({ default: module.Overview })),
)

const CopOverview = lazy(() =>
  import('./Pages/Cop/Overview').then((module) => ({ default: module.Overview })),
)

const TechnicalAuditOverview = lazy(() =>
  import('./Pages/TechnicalAudit/Overview').then((module) => ({ default: module.Overview })),
)

const FleetManagementOverview = lazy(() =>
  import('./Pages/FleetManagement/Overview').then((module) => ({ default: module.Overview })),
)

const CustomerExperienceOverview = lazy(() =>
  import('./Pages/CustomerExperience/Overview').then((module) => ({ default: module.Overview })),
)

const CorporateOverview = lazy(() =>
  import('./Pages/CorporateOverview').then((module) => ({ default: module.CorporateOverview })),
)

const MyProfile: React.LazyExoticComponent<ComponentType> = lazy(() =>
  import('./Pages/MyProfile').then((module) => ({ default: module.MyProfile })),
)

const Preferences: React.LazyExoticComponent<ComponentType> = lazy(() =>
  import('./Pages/Preferences').then((module) => ({ default: module.Preferences })),
)

const AccessProfilesPreview: React.LazyExoticComponent<ComponentType> = lazy(() =>
  import('./Pages/AccessProfilesPreview').then((module) => ({
    default: module.AccessProfilesPreview,
  })),
)

/**
 * Abas oficiais das Configurações. A validação da rota e a escolha da página
 * saem desta mesma lista, então uma URL fora dela nunca herda a última página
 * da cadeia: `configPage` só chega à seleção depois de reconhecido aqui.
 */
const settingsPageComponents = {
  'meu-perfil': MyProfile,
  preferencias: Preferences,
  usuarios: pageComponents.users,
  'perfis-acesso': AccessProfilesPreview,
  historico: pageComponents.history,
}

type SettingsPageSlug = keyof typeof settingsPageComponents

function isSettingsPageSlug(value: string | undefined): value is SettingsPageSlug {
  return value !== undefined && Object.prototype.hasOwnProperty.call(settingsPageComponents, value)
}

const corporateOverviewPath = '/dashboard/inicio'

const osSidebarItems: AreaSidebarItem[] = navigationGroups.reduce<AreaSidebarItem[]>(
  (acc, group) => [...acc, ...group.items],
  [],
)

function isPageKey(key: string): key is PageKey {
  return key in pageSlugs
}

/**
 * Itens de navegação de cada departamento, direto dos `pageConfig` já
 * publicados.
 *
 * Lista única: serve tanto à sidebar do departamento quanto ao contexto
 * preservado enquanto as Configurações ocupam o conteúdo central. Os nomes, os
 * ícones e a ordem continuam sendo os do `pageConfig` de origem, e o caminho de
 * cada item vem de `departmentPagePath`, e não de um segundo mapa de rotas.
 */
const departmentNavigationItems: Record<BiAreaId, AreaSidebarItem[]> = {
  'auditoria-tecnica': technicalAuditNavigationItems,
  cobranca: billingNavigationItems,
  comercial: commercialNavigationItems,
  cop: copNavigationItems,
  'experiencia-cliente': customerExperienceNavigationItems,
  fidelizacao: loyaltyNavigationItems,
  'gestao-frota': fleetManagementNavigationItems,
  os: osSidebarItems,
  retencao: retentionNavigationItems,
  retiradas: equipmentRetrievalNavigationItems,
  'suporte-tecnico': technicalSupportNavigationItems,
}

/**
 * Visão Geral real de um departamento: o componente próprio dele e os textos do
 * cabeçalho, como já estavam publicados no `pageConfig`.
 *
 * Ordens de Serviço fica de fora por construção: ela tem componentes e rotas
 * próprios para todas as páginas, e não passa pela rota departamental.
 */
type DepartmentOverview = {
  Component: React.LazyExoticComponent<ComponentType>
  title: string
  subtitle: string
}

const departmentOverviews: Record<Exclude<BiAreaId, 'os'>, DepartmentOverview> = {
  'auditoria-tecnica': {
    Component: TechnicalAuditOverview,
    title: technicalAuditOverviewTitle,
    subtitle: technicalAuditOverviewSubtitle,
  },
  cobranca: {
    Component: BillingOverview,
    title: billingOverviewTitle,
    subtitle: billingOverviewSubtitle,
  },
  comercial: {
    Component: CommercialOverview,
    title: commercialOverviewTitle,
    subtitle: commercialOverviewSubtitle,
  },
  cop: { Component: CopOverview, title: copOverviewTitle, subtitle: copOverviewSubtitle },
  'experiencia-cliente': {
    Component: CustomerExperienceOverview,
    title: customerExperienceOverviewTitle,
    subtitle: customerExperienceOverviewSubtitle,
  },
  fidelizacao: {
    Component: LoyaltyOverview,
    title: loyaltyOverviewTitle,
    subtitle: loyaltyOverviewSubtitle,
  },
  'gestao-frota': {
    Component: FleetManagementOverview,
    title: fleetManagementOverviewTitle,
    subtitle: fleetManagementOverviewSubtitle,
  },
  retencao: {
    Component: RetentionOverview,
    title: retentionOverviewTitle,
    subtitle: retentionOverviewSubtitle,
  },
  retiradas: {
    Component: EquipmentRetrievalOverview,
    title: equipmentRetrievalOverviewTitle,
    subtitle: equipmentRetrievalOverviewSubtitle,
  },
  'suporte-tecnico': {
    Component: TechnicalSupportOverview,
    title: technicalSupportOverviewTitle,
    subtitle: technicalSupportOverviewSubtitle,
  },
}

function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

/**
 * Descarta de vez a escolha de departamento inicial que deixou de ser permitida.
 *
 * A regra central já ignora uma escolha inválida ao resolver a navegação, mas
 * ignorar não basta: ela continuaria gravada e voltaria a valer sozinha caso o
 * departamento fosse concedido de novo. Aqui ela some do estado e do
 * armazenamento, e o Analista passa a usar o primeiro departamento permitido até
 * escolher outro.
 *
 * A remoção acontece em efeito, nunca durante a renderização, e não cria ciclo:
 * `clearHomeDepartmentId` não atualiza estado quando não há nada a remover, e o
 * caminho resolvido é o mesmo antes e depois, porque a escolha inválida já era
 * ignorada.
 */
function useDiscardedHomeDepartment() {
  const { user } = useAuth()
  const { clearHomeDepartmentId, homeDepartmentIdFor } = usePreferences()

  const userId = user?.id ?? null
  const discard = shouldDiscardHomeDepartment(
    user,
    userId === null ? null : homeDepartmentIdFor(userId),
  )

  useEffect(() => {
    if (userId !== null && discard) clearHomeDepartmentId(userId)
  }, [clearHomeDepartmentId, discard, userId])
}

function AppRoutes() {
  const { user, login, logout } = useAuth()
  const { homeDepartmentIdFor } = usePreferences()
  const navigate = useNavigate()

  useDiscardedHomeDepartment()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Página Inicial efetiva de quem está autenticado, pela regra central: a
  // Visão Geral Executiva do Administrador e do Executivo, ou a Visão Geral do
  // departamento inicial do Analista.
  const homePath = resolveHomePath(user, user ? homeDepartmentIdFor(user.id) : null)

  return (
    <Routes>
      <Route
        element={
          user ? (
            <Navigate replace to={homePath} />
          ) : (
            <Login
              onLogin={(email) => {
                const authenticated = login(email)
                // O usuário autenticado só existe na renderização seguinte, então
                // a entrada passa pela Página Inicial, que aplica a mesma regra
                // central e encaminha o Analista sem renderizar a Visão Geral
                // Executiva.
                if (authenticated) navigate(corporateOverviewPath)
                return authenticated
              }}
            />
          )
        }
        path="/login"
      />
      <Route
        element={user ? <Navigate replace to={homePath} /> : <Navigate replace to="/login" />}
        path="/"
      />
      <Route
        element={user ? <Navigate replace to={homePath} /> : <Navigate replace to="/login" />}
        path="/dashboard"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/visao-geral" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/visao-geral"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/temporal" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/temporal"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/calendario" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/calendario"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/status" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/status"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/categorias" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/categorias"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/resolucoes" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/resolucoes"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/improdutividade" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/improdutividade"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/fechamento" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/fechamento"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/tecnicos" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/tecnicos"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/clientes" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/clientes"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/qualidade" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/qualidade"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/inteligencia" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/inteligencia"
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/os/modelo" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/modelo"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/:pageSlug"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="visao-geral" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/visao-geral"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="temporal" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/temporal"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="calendario" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/calendario"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="status" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/status"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="categorias" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/categorias"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="resolucoes" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/resolucoes"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="improdutividade" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/improdutividade"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="fechamento" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/fechamento"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="tecnicos" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/tecnicos"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="clientes" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/clientes"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="qualidade" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/qualidade"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="inteligencia" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/inteligencia"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION} redirectTo={corporateOverviewPath}>
              <DashboardRoute onLogout={handleLogout} pageSlug="modelo" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/modelo"
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={COMMERCIAL_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="comercial"
                onLogout={handleLogout}
                pageKey={COMMERCIAL_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={commercialOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={TECHNICAL_SUPPORT_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="suporte-tecnico"
                onLogout={handleLogout}
                pageKey={TECHNICAL_SUPPORT_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={technicalSupportOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={BILLING_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="cobranca"
                onLogout={handleLogout}
                pageKey={BILLING_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={billingOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={EQUIPMENT_RETRIEVAL_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="retiradas"
                onLogout={handleLogout}
                pageKey={EQUIPMENT_RETRIEVAL_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={equipmentRetrievalOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={LOYALTY_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="fidelizacao"
                onLogout={handleLogout}
                pageKey={LOYALTY_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={loyaltyOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={RETENTION_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="retencao"
                onLogout={handleLogout}
                pageKey={RETENTION_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={retentionOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={COP_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="cop"
                onLogout={handleLogout}
                pageKey={COP_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={copOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={TECHNICAL_AUDIT_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="auditoria-tecnica"
                onLogout={handleLogout}
                pageKey={TECHNICAL_AUDIT_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={technicalAuditOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={FLEET_MANAGEMENT_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="gestao-frota"
                onLogout={handleLogout}
                pageKey={FLEET_MANAGEMENT_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={fleetManagementOverviewPath}
      />
      <Route
        element={
          user ? (
            <RequirePermission
              permission={CUSTOMER_EXPERIENCE_ACCESS_PERMISSION}
              redirectTo={corporateOverviewPath}
            >
              <DepartmentPageRoute
                areaId="experiencia-cliente"
                onLogout={handleLogout}
                pageKey={CUSTOMER_EXPERIENCE_OVERVIEW_KEY}
              />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={customerExperienceOverviewPath}
      />
      {/* Rota única das demais páginas departamentais. Fica atrás de todas as
          rotas fixas na ordenação do React Router, que prefere segmento
          literal a parâmetro: Configurações, Visão Geral Executiva, Ordens de
          Serviço, as dez Visões Gerais e as rotas administrativas continuam
          resolvendo nos próprios blocos. Departamento inexistente e página
          desconhecida caem no redirecionamento seguro dentro do componente. */}
      <Route
        element={
          user ? (
            <DepartmentPageRoute onLogout={handleLogout} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/:departmentSlug/:pageSlug"
      />
      <Route
        element={
          user ? <HomeRoute onLogout={handleLogout} /> : <Navigate replace to="/login" />
        }
        path={corporateOverviewPath}
      />
      <Route
        element={
          user ? (
            <Navigate replace to="/dashboard/configuracoes/preferencias" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/configuracoes"
      />
      <Route
        element={
          user ? (
            <PortalSettingsRoute onLogout={handleLogout} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/configuracoes/:configPage"
      />
      <Route
        element={
          user ? (
            <RequirePermission permission={ADMIN_USERS_READ_PERMISSION} redirectTo={corporateOverviewPath}>
              <Navigate replace to="/dashboard/configuracoes/usuarios" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/usuarios"
      />
      {/* O Histórico não tem rota legada em /dashboard: sua única URL oficial é
          /dashboard/configuracoes/historico. */}
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

function DashboardRoute({
  onLogout,
  pageSlug: pageSlugProp,
}: {
  onLogout: () => void
  pageSlug?: string
}) {
  const params = useParams()
  const pageSlug = pageSlugProp ?? params.pageSlug
  const navigate = useNavigate()
  const { user } = useAuth()
  const activePage = pageFromSlug(pageSlug) ?? 'overview'
  const PageComponent = pageComponents[activePage]

  if (pageSlug && !pageFromSlug(pageSlug)) {
    return <Navigate replace to={corporateOverviewPath} />
  }

  // Usuários e Histórico são páginas das Configurações, não de Ordens de
  // Serviço: a rota genérica não pode renderizá-las. A verificação vem antes do
  // acesso departamental, que só descreve páginas de OS.
  if (activePage === 'users' || activePage === 'history') {
    return <Navigate replace to={corporateOverviewPath} />
  }

  const activePageAccessState = getDepartmentPageAccessState(user, 'os', activePage)
  const overviewAccessState = getDepartmentPageAccessState(user, 'os', 'overview')

  // Só a página habilitada renderiza: sem permissão ou em desenvolvimento, cai na Visão Geral.
  if (activePageAccessState !== 'enabled') {
    if (activePage !== 'overview' && overviewAccessState === 'enabled') {
      return <Navigate replace to="/dashboard/os/visao-geral" />
    }

    return <Navigate replace to={corporateOverviewPath} />
  }

  const showOsSidebar = osSidebarItems.some((item) => item.key === activePage)

  const accessibleOsSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'os',
    osSidebarItems,
  )

  function handleOsSidebarSelect(key: string) {
    if (!isPageKey(key)) return
    navigate(`/dashboard/os/${pageSlugs[key]}`)
  }

  function handlePageChange(page: PageKey) {
    if (page === 'users') {
      navigate(`/dashboard/${pageSlugs[page]}`)
      return
    }
    // O Histórico fica só nas Configurações e não tem rota em /dashboard.
    if (page === 'history') return

    navigate(`/dashboard/os/${pageSlugs[page]}`)
  }

  return (
    <DashboardDataProvider>
      <DashboardLayout
        activePage={activePage}
        onLogout={onLogout}
        onPageChange={handlePageChange}
        sidebar={
          showOsSidebar ? (
            <DepartmentAreaSidebar
              activeKey={activePage}
              areaId="os"
              items={accessibleOsSidebarItems}
              onItemSelect={handleOsSidebarSelect}
            />
          ) : undefined
        }
      >
        <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
          <PageComponent />
        </Suspense>
      </DashboardLayout>
    </DashboardDataProvider>
  )
}

/**
 * Departamentos que o usuário pode abrir — única regra de acesso da lista,
 * baseada em `requiredPermission` e `hasPermission`. `admin.full` e os demais
 * perfis continuam resolvidos dentro de `hasPermission`.
 */
function useAccessibleBiAreas(): BiArea[] {
  const { hasPermission } = useAuth()

  return biAreas.filter(
    (area) => area.requiredPermission === null || hasPermission(area.requiredPermission),
  )
}

/**
 * Ícone de cada departamento, indexado pelo `BiAreaId` real — a chave estável do
 * repositório, não o rótulo exibido. Definição única: alimenta tanto a lista de
 * departamentos quanto a identificação do departamento na barra estreita, nos
 * dois estados da sidebar.
 */
const biAreaIcons: Record<BiAreaId, LucideIcon> = {
  'auditoria-tecnica': ClipboardCheck,
  cobranca: CircleDollarSign,
  comercial: Handshake,
  cop: Radar,
  'experiencia-cliente': MessagesSquare,
  fidelizacao: HeartHandshake,
  'gestao-frota': Truck,
  // Ordens de Serviço não constava da lista aprovada, que cobre dez
  // departamentos. Chave de serviço em campo, distinta do ClipboardCheck da
  // Auditoria Técnica, no lugar do prédio genérico. Sujeito a aprovação.
  os: Wrench,
  retencao: UserRoundCheck,
  retiradas: PackageMinus,
  'suporte-tecnico': Headset,
}

/** Nome exibido do departamento, direto do registro de áreas. */
function biAreaLabel(areaId: BiAreaId): string {
  return biAreas.find((area) => area.id === areaId)?.label ?? ''
}

function biAreaSidebarItems(areas: BiArea[]): AreaSidebarItem[] {
  return areas.map((area) => ({
    key: area.id,
    label: area.label,
    icon: biAreaIcons[area.id],
    title: area.label,
  }))
}

function DepartmentNavigationSidebar() {
  const navigate = useNavigate()
  const availableAreas = useAccessibleBiAreas()

  function handleDepartmentSelect(key: string) {
    const area = availableAreas.find((item) => item.id === key)
    if (!area) return
    navigate(area.overviewPath)
  }

  return (
    <AreaSidebar
      activeKey={null}
      areaLabel="Dashboards"
      items={biAreaSidebarItems(availableAreas)}
      onItemSelect={handleDepartmentSelect}
    />
  )
}

/**
 * Sidebar das páginas de um departamento, com alternância visual para a lista de
 * dashboards. O modo é estado local da sidebar: abrir a lista não muda a rota,
 * o departamento atual nem o conteúdo central — o departamento continua vindo da
 * rota, pelo `areaId` recebido. Escolher um departamento navega para a visão
 * geral dele e volta ao modo de páginas.
 *
 * Os dois modos usam o mesmo rótulo "Dashboards" no topo: o nome do
 * departamento continua no cabeçalho e no conteúdo central.
 */
function DepartmentAreaSidebar({
  activeKey,
  areaId,
  items,
  onItemSelect,
}: {
  activeKey: string | null
  areaId: BiAreaId
  items: AreaSidebarItem[]
  onItemSelect: (key: string) => void
}) {
  const navigate = useNavigate()
  const availableAreas = useAccessibleBiAreas()
  const [showDepartments, setShowDepartments] = useState(false)

  function handleDepartmentSelect(key: string) {
    const area = availableAreas.find((item) => item.id === key)
    if (!area) return

    setShowDepartments(false)
    navigate(area.overviewPath)
  }

  if (showDepartments) {
    return (
      <AreaSidebar
        activeKey={areaId}
        areaLabel="Dashboards"
        items={biAreaSidebarItems(availableAreas)}
        onItemSelect={handleDepartmentSelect}
      />
    )
  }

  return (
    <AreaSidebar
      activeKey={activeKey}
      areaLabel="Dashboards"
      contextIcon={biAreaIcons[areaId]}
      contextLabel={biAreaLabel(areaId)}
      items={items}
      onDashboardsSelect={() => setShowDepartments(true)}
      onItemSelect={onItemSelect}
    />
  )
}

/**
 * Sidebar exibida enquanto as configurações ocupam o conteúdo central: mantém o
 * contexto da página de origem, com o item de origem ainda selecionado e a
 * navegação ativa — escolher um item sai das configurações.
 */
function SettingsOriginSidebar({ originPathname }: { originPathname: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const area = getActiveBiArea(originPathname)

  // Visão Geral Executiva ou acesso direto sem origem válida: contexto de departamentos.
  if (!area) return <DepartmentNavigationSidebar />

  const departmentId = area.id

  /**
   * Mesma regra de acesso das sidebars departamentais, e não os itens brutos do
   * `pageConfig`: entrar nas Configurações não pode revelar uma página que o
   * usuário não recebeu, como o Modelo Dimensional. Nomes, ícones e ordem
   * continuam sendo os do catálogo, e a decisão continua inteira em
   * `getDepartmentPageAccessState`.
   */
  const sidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    departmentId,
    departmentNavigationItems[departmentId],
  )

  function handleItemSelect(key: string) {
    const path = departmentPagePath(departmentId, key)
    if (path) navigate(path)
  }

  return (
    <AreaSidebar
      activeKey={departmentPageKeyFromPath(area.id, originPathname)}
      areaLabel={area.label}
      items={sidebarItems}
      onItemSelect={handleItemSelect}
    />
  )
}

function PortalSettingsRoute({ onLogout }: { onLogout: () => void }) {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const configPage = params.configPage

  const canReadUsers = hasPermission(ADMIN_USERS_READ_PERMISSION)
  const isAdmin = hasPermission(ADMIN_FULL_PERMISSION)

  // Repassado em toda navegação interna para não perder a página de origem.
  const returnState = settingsReturnState(location)
  const originPathname = resolveSettingsOriginPathname(location.state)

  // Qualquer slug fora da lista de abas cai aqui, sem renderizar nenhuma página.
  if (!isSettingsPageSlug(configPage)) {
    return <Navigate replace state={returnState} to="/dashboard/configuracoes/meu-perfil" />
  }

  if (configPage === 'usuarios' && !canReadUsers) {
    return <Navigate replace to={corporateOverviewPath} />
  }

  // Histórico e Perfis de acesso são exclusivos do Administrador. Quem só lê
  // usuários volta para a aba de Usuários; sem nem isso, sai das Configurações.
  if ((configPage === 'historico' || configPage === 'perfis-acesso') && !isAdmin) {
    return canReadUsers ? (
      <Navigate replace state={returnState} to="/dashboard/configuracoes/usuarios" />
    ) : (
      <Navigate replace to={corporateOverviewPath} />
    )
  }

  const SettingsPage = settingsPageComponents[configPage]

  const tabClasses = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'relative z-10 -mb-px inline-flex h-10 cursor-pointer items-center rounded-t-lg border border-[#e4e7ee] border-b-white bg-white px-4 text-[13px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
      : 'inline-flex h-10 cursor-pointer items-center rounded-t-lg border border-[#e4e7ee] bg-[#f4f6fa] px-4 text-[13px] font-medium text-[#667085] transition hover:bg-[#eef1f6] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

  return (
    <DashboardDataProvider>
      <DashboardLayout
        activePage={null}
        onLogout={onLogout}
        // O Histórico não existe fora das Configurações, então nunca vira
        // /dashboard/historico; as demais páginas seguem como antes.
        onPageChange={(page) => {
          if (page === 'history') return
          navigate(`/dashboard/${pageSlugs[page]}`)
        }}
        showPageHeader={false}
        sidebar={<SettingsOriginSidebar originPathname={originPathname} />}
        subtitle="Configurações pessoais e administrativas do portal"
        title="Configurações"
      >
        {/* Coluna presa à altura da área central: o painel branco herda a sobra e
            nunca empurra a página, então o rodapé fica no mesmo lugar em toda aba. */}
        <div className="relative flex h-full flex-col">
          <div className="flex flex-none items-end gap-1">
            <NavLink
              className={tabClasses}
              state={returnState}
              to="/dashboard/configuracoes/meu-perfil"
            >
              Meu perfil
            </NavLink>
            <NavLink
              className={tabClasses}
              state={returnState}
              to="/dashboard/configuracoes/preferencias"
            >
              Preferências
            </NavLink>
            {canReadUsers ? (
              <NavLink
                className={tabClasses}
                state={returnState}
                to="/dashboard/configuracoes/usuarios"
              >
                Usuários
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink
                className={tabClasses}
                state={returnState}
                to="/dashboard/configuracoes/perfis-acesso"
              >
                Perfis de acesso
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink
                className={tabClasses}
                state={returnState}
                to="/dashboard/configuracoes/historico"
              >
                Histórico
              </NavLink>
            ) : null}
          </div>
          {/* Painel e rolagem separados de propósito. Enquanto o próprio painel
              rolava, a barra era desenhada na borda dele: ela nascia colada à
              borda arredondada, passava por cima do respiro interno e cortava os
              cantos. Agora o painel só desenha borda, cantos e fundo, com
              overflow-hidden para recortar a barra nos cantos, e quem rola é a
              camada de dentro, que leva o respiro junto. A barra passa a viver
              dentro do painel, e continua visível. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl rounded-tr-xl border border-[#e4e7ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
                <SettingsPage />
              </Suspense>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </DashboardDataProvider>
  )
}

/**
 * Página de um dos dez departamentos, resolvida pelos catálogos.
 *
 * Uma rota e um componente para todas elas. O departamento e a página podem vir
 * por parâmetro da URL (rota genérica) ou por propriedade (as dez rotas fixas de
 * Visão Geral, que mantêm o endereço e a proteção que já tinham). O resto é
 * igual nos dois casos, e é por isso que não existem dezenas de blocos
 * repetidos.
 *
 * A ordem das verificações é do mais geral para o mais específico:
 *
 * 1. departamento e página precisam existir nos catálogos;
 * 2. Ordens de Serviço não passa por aqui: as páginas dela têm rotas e
 *    componentes reais, e um endereço de OS que chegue nesta rota é endereço
 *    desconhecido;
 * 3. o departamento precisa estar liberado ao usuário, como na lista de
 *    dashboards;
 * 4. a página precisa estar concedida pelo par departamento e página, exatamente
 *    a mesma regra que a sidebar aplica.
 *
 * Sem acesso, o portal tenta a Visão Geral do próprio departamento e, se ela
 * também não estiver concedida, volta para a Visão Geral Executiva. Ter rota
 * nunca substitui ter acesso: uma página publicada e não concedida continua
 * fora do alcance do usuário.
 */
function DepartmentPageRoute({
  areaId: areaIdProp,
  onLogout,
  pageKey: pageKeyProp,
}: {
  areaId?: BiAreaId
  onLogout: () => void
  pageKey?: string
}) {
  const params = useParams()
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()

  const areaId = areaIdProp ?? findDepartmentIdBySlug(params.departmentSlug)
  const area = areaId === null ? null : (biAreas.find((item) => item.id === areaId) ?? null)

  const page =
    area === null || area.id === 'os'
      ? null
      : pageKeyProp === undefined
        ? findDepartmentPageBySlug(area.id, params.pageSlug)
        : findDepartmentPageByKey(area.id, pageKeyProp)

  if (area === null || page === null) return <Navigate replace to={corporateOverviewPath} />

  if (area.requiredPermission !== null && !hasPermission(area.requiredPermission)) {
    return <Navigate replace to={corporateOverviewPath} />
  }

  if (getDepartmentPageAccessState(user, area.id, page.key) !== 'enabled') {
    const overviewPath = departmentPagePath(area.id, OVERVIEW_PAGE_KEY)

    if (
      page.key !== OVERVIEW_PAGE_KEY &&
      overviewPath !== null &&
      getDepartmentPageAccessState(user, area.id, OVERVIEW_PAGE_KEY) === 'enabled'
    ) {
      return <Navigate replace to={overviewPath} />
    }

    return <Navigate replace to={corporateOverviewPath} />
  }

  const departmentId = area.id

  const sidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    departmentId,
    departmentNavigationItems[departmentId],
  )

  function handleSidebarSelect(key: string) {
    const path = departmentPagePath(departmentId, key)
    if (path) navigate(path)
  }

  // Ordens de Serviço já saiu acima, então o departamento sempre tem Visão Geral
  // própria registrada.
  const overview = departmentOverviews[departmentId as Exclude<BiAreaId, 'os'>]
  const isOverview = page.key === OVERVIEW_PAGE_KEY

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(dashboardPage) => navigate(`/dashboard/${pageSlugs[dashboardPage]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={page.key}
          areaId={area.id}
          items={sidebarItems}
          onItemSelect={handleSidebarSelect}
        />
      }
      subtitle={isOverview ? overview.subtitle : `Departamento ${area.label}`}
      title={isOverview ? overview.title : page.label}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        {isOverview ? (
          <overview.Component />
        ) : (
          <UpcomingDashboard departmentLabel={area.label} pageLabel={page.label} />
        )}
      </Suspense>
    </DashboardLayout>
  )
}

/**
 * Página Inicial do portal.
 *
 * É a única porta de `/dashboard/inicio`, e é ela que impede a Visão Geral
 * Executiva de aparecer para quem não deve vê-la. Administrador e Executivo
 * renderizam a página executiva; qualquer outro perfil é encaminhado para a
 * Visão Geral do departamento inicial efetivo, ou para o destino seguro quando
 * não tem nenhuma concedida.
 *
 * Concentrar a decisão aqui também conserta os redirecionamentos que já
 * existiam: todo `redirectTo` do portal aponta para esta rota, então um Analista
 * recusado em qualquer página cai na Página Inicial dele, e não na executiva.
 * O encaminhamento acontece antes de qualquer renderização, sem piscar a página
 * executiva e sem criar ciclo: o destino é sempre uma rota diferente desta.
 */
function HomeRoute({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const { homeDepartmentIdFor } = usePreferences()

  if (!usesCorporateHome(user)) {
    return <Navigate replace to={resolveHomePath(user, user ? homeDepartmentIdFor(user.id) : null)} />
  }

  return <CorporateOverviewRoute onLogout={onLogout} />
}

function CorporateOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={<DepartmentNavigationSidebar />}
      subtitle="Indicadores executivos consolidados de todos os departamentos"
      title="Visão Geral Executiva"
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CorporateOverview />
      </Suspense>
    </DashboardLayout>
  )
}

export default App
