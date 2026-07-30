import { lazy, Suspense, useState, type ComponentType } from 'react'
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
import { Building2 } from 'lucide-react'

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
import { DashboardDataProvider } from './contexts/DashboardDataContext'
import { RequirePermission } from './components/routing/RequirePermission'
import { AreaSidebar, type AreaSidebarItem } from './components/navigation/AreaSidebar'
import { getDepartmentPageAccessState } from './lib/accessControl'
import { getAccessibleDepartmentSidebarItems } from './lib/sidebarAccess'
import { resolveSettingsOriginPathname, settingsReturnState } from './lib/settingsNavigation'
import {
  biAreas,
  getActiveBiArea,
  osPageSlugFromPath,
  type BiArea,
  type BiAreaId,
} from './config/biAreas'
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

/**
 * Abas oficiais das Configurações. A validação da rota e a escolha da página
 * saem desta mesma lista, então uma URL fora dela nunca herda a última página
 * da cadeia: `configPage` só chega à seleção depois de reconhecido aqui.
 */
const settingsPageComponents = {
  'meu-perfil': MyProfile,
  preferencias: Preferences,
  usuarios: pageComponents.users,
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
 * Sidebar de uma área, descrita a partir dos itens já publicados no `pageConfig`
 * de cada departamento — usada para reproduzir o contexto de origem enquanto as
 * configurações ocupam o conteúdo central.
 */
type AreaSidebarConfig = {
  items: AreaSidebarItem[]
  /** Item selecionado para o pathname informado. */
  activeKeyFor: (pathname: string) => string | null
  /** Destino de um item habilitado; null quando o item não navega. */
  pathFor: (key: string) => string | null
}

/** Departamentos publicam somente a visão geral; os demais itens seguem desabilitados. */
function departmentSidebarConfig(
  items: AreaSidebarItem[],
  overviewKey: string,
  overviewPath: string,
): AreaSidebarConfig {
  return {
    items,
    activeKeyFor: (pathname) => (pathname === overviewPath ? overviewKey : null),
    pathFor: (key) => (key === overviewKey ? overviewPath : null),
  }
}

const areaSidebarConfigs: Record<BiAreaId, AreaSidebarConfig> = {
  os: {
    items: osSidebarItems,
    activeKeyFor: (pathname) => pageFromSlug(osPageSlugFromPath(pathname) ?? undefined),
    pathFor: (key) => (isPageKey(key) ? `/dashboard/os/${pageSlugs[key]}` : null),
  },
  comercial: departmentSidebarConfig(
    commercialNavigationItems,
    COMMERCIAL_OVERVIEW_KEY,
    commercialOverviewPath,
  ),
  'suporte-tecnico': departmentSidebarConfig(
    technicalSupportNavigationItems,
    TECHNICAL_SUPPORT_OVERVIEW_KEY,
    technicalSupportOverviewPath,
  ),
  cobranca: departmentSidebarConfig(
    billingNavigationItems,
    BILLING_OVERVIEW_KEY,
    billingOverviewPath,
  ),
  retiradas: departmentSidebarConfig(
    equipmentRetrievalNavigationItems,
    EQUIPMENT_RETRIEVAL_OVERVIEW_KEY,
    equipmentRetrievalOverviewPath,
  ),
  fidelizacao: departmentSidebarConfig(
    loyaltyNavigationItems,
    LOYALTY_OVERVIEW_KEY,
    loyaltyOverviewPath,
  ),
  retencao: departmentSidebarConfig(
    retentionNavigationItems,
    RETENTION_OVERVIEW_KEY,
    retentionOverviewPath,
  ),
  cop: departmentSidebarConfig(copNavigationItems, COP_OVERVIEW_KEY, copOverviewPath),
  'auditoria-tecnica': departmentSidebarConfig(
    technicalAuditNavigationItems,
    TECHNICAL_AUDIT_OVERVIEW_KEY,
    technicalAuditOverviewPath,
  ),
  'gestao-frota': departmentSidebarConfig(
    fleetManagementNavigationItems,
    FLEET_MANAGEMENT_OVERVIEW_KEY,
    fleetManagementOverviewPath,
  ),
  'experiencia-cliente': departmentSidebarConfig(
    customerExperienceNavigationItems,
    CUSTOMER_EXPERIENCE_OVERVIEW_KEY,
    customerExperienceOverviewPath,
  ),
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

function AppRoutes() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Routes>
      <Route
        element={
          user ? (
            <Navigate replace to={corporateOverviewPath} />
          ) : (
            <Login
              onLogin={(email) => {
                const authenticated = login(email)
                if (authenticated) navigate(corporateOverviewPath)
                return authenticated
              }}
            />
          )
        }
        path="/login"
      />
      <Route
        element={
          user ? (
            <Navigate replace to={corporateOverviewPath} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/"
      />
      <Route
        element={
          user ? (
            <Navigate replace to={corporateOverviewPath} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
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
              <CommercialOverviewRoute onLogout={handleLogout} />
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
              <TechnicalSupportOverviewRoute onLogout={handleLogout} />
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
              <BillingOverviewRoute onLogout={handleLogout} />
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
              <EquipmentRetrievalOverviewRoute onLogout={handleLogout} />
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
              <LoyaltyOverviewRoute onLogout={handleLogout} />
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
              <RetentionOverviewRoute onLogout={handleLogout} />
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
              <CopOverviewRoute onLogout={handleLogout} />
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
              <TechnicalAuditOverviewRoute onLogout={handleLogout} />
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
              <FleetManagementOverviewRoute onLogout={handleLogout} />
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
              <CustomerExperienceOverviewRoute onLogout={handleLogout} />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={customerExperienceOverviewPath}
      />
      <Route
        element={
          user ? (
            <CorporateOverviewRoute onLogout={handleLogout} />
          ) : (
            <Navigate replace to="/login" />
          )
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

function biAreaSidebarItems(areas: BiArea[]): AreaSidebarItem[] {
  return areas.map((area) => ({
    key: area.id,
    label: area.label,
    icon: Building2,
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
  const area = getActiveBiArea(originPathname)

  // Visão Geral Executiva ou acesso direto sem origem válida: contexto de departamentos.
  if (!area) return <DepartmentNavigationSidebar />

  const config = areaSidebarConfigs[area.id]

  function handleItemSelect(key: string) {
    const path = config.pathFor(key)
    if (path) navigate(path)
  }

  return (
    <AreaSidebar
      activeKey={config.activeKeyFor(originPathname)}
      areaLabel={area.label}
      items={config.items}
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

  // Histórico é exclusivo do Administrador. Quem só lê usuários volta para a
  // aba de Usuários; sem nem isso, sai das Configurações.
  if (configPage === 'historico' && !isAdmin) {
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
                to="/dashboard/configuracoes/historico"
              >
                Histórico
              </NavLink>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-b-xl rounded-tr-xl border border-[#e4e7ee] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
            <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
              <SettingsPage />
            </Suspense>
          </div>
        </div>
      </DashboardLayout>
    </DashboardDataProvider>
  )
}

function CommercialOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const commercialSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'comercial',
    commercialNavigationItems,
  )

  function handleCommercialSidebarSelect(key: string) {
    if (key !== COMMERCIAL_OVERVIEW_KEY) return
    navigate(commercialOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={COMMERCIAL_OVERVIEW_KEY}
          areaId="comercial"
          items={commercialSidebarItems}
          onItemSelect={handleCommercialSidebarSelect}
        />
      }
      subtitle={commercialOverviewSubtitle}
      title={commercialOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CommercialOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function TechnicalSupportOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const technicalSupportSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'suporte-tecnico',
    technicalSupportNavigationItems,
  )

  function handleTechnicalSupportSidebarSelect(key: string) {
    if (key !== TECHNICAL_SUPPORT_OVERVIEW_KEY) return
    navigate(technicalSupportOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={TECHNICAL_SUPPORT_OVERVIEW_KEY}
          areaId="suporte-tecnico"
          items={technicalSupportSidebarItems}
          onItemSelect={handleTechnicalSupportSidebarSelect}
        />
      }
      subtitle={technicalSupportOverviewSubtitle}
      title={technicalSupportOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <TechnicalSupportOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function BillingOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const billingSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'cobranca',
    billingNavigationItems,
  )

  function handleBillingSidebarSelect(key: string) {
    if (key !== BILLING_OVERVIEW_KEY) return
    navigate(billingOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={BILLING_OVERVIEW_KEY}
          areaId="cobranca"
          items={billingSidebarItems}
          onItemSelect={handleBillingSidebarSelect}
        />
      }
      subtitle={billingOverviewSubtitle}
      title={billingOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <BillingOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function EquipmentRetrievalOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const equipmentRetrievalSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'retiradas',
    equipmentRetrievalNavigationItems,
  )

  function handleEquipmentRetrievalSidebarSelect(key: string) {
    if (key !== EQUIPMENT_RETRIEVAL_OVERVIEW_KEY) return
    navigate(equipmentRetrievalOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={EQUIPMENT_RETRIEVAL_OVERVIEW_KEY}
          areaId="retiradas"
          items={equipmentRetrievalSidebarItems}
          onItemSelect={handleEquipmentRetrievalSidebarSelect}
        />
      }
      subtitle={equipmentRetrievalOverviewSubtitle}
      title={equipmentRetrievalOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <EquipmentRetrievalOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function LoyaltyOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const loyaltySidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'fidelizacao',
    loyaltyNavigationItems,
  )

  function handleLoyaltySidebarSelect(key: string) {
    if (key !== LOYALTY_OVERVIEW_KEY) return
    navigate(loyaltyOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={LOYALTY_OVERVIEW_KEY}
          areaId="fidelizacao"
          items={loyaltySidebarItems}
          onItemSelect={handleLoyaltySidebarSelect}
        />
      }
      subtitle={loyaltyOverviewSubtitle}
      title={loyaltyOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <LoyaltyOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function RetentionOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const retentionSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'retencao',
    retentionNavigationItems,
  )

  function handleRetentionSidebarSelect(key: string) {
    if (key !== RETENTION_OVERVIEW_KEY) return
    navigate(retentionOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={RETENTION_OVERVIEW_KEY}
          areaId="retencao"
          items={retentionSidebarItems}
          onItemSelect={handleRetentionSidebarSelect}
        />
      }
      subtitle={retentionOverviewSubtitle}
      title={retentionOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <RetentionOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function CopOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const copSidebarItems = getAccessibleDepartmentSidebarItems(user, 'cop', copNavigationItems)

  function handleCopSidebarSelect(key: string) {
    if (key !== COP_OVERVIEW_KEY) return
    navigate(copOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={COP_OVERVIEW_KEY}
          areaId="cop"
          items={copSidebarItems}
          onItemSelect={handleCopSidebarSelect}
        />
      }
      subtitle={copOverviewSubtitle}
      title={copOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CopOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function TechnicalAuditOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const technicalAuditSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'auditoria-tecnica',
    technicalAuditNavigationItems,
  )

  function handleTechnicalAuditSidebarSelect(key: string) {
    if (key !== TECHNICAL_AUDIT_OVERVIEW_KEY) return
    navigate(technicalAuditOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={TECHNICAL_AUDIT_OVERVIEW_KEY}
          areaId="auditoria-tecnica"
          items={technicalAuditSidebarItems}
          onItemSelect={handleTechnicalAuditSidebarSelect}
        />
      }
      subtitle={technicalAuditOverviewSubtitle}
      title={technicalAuditOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <TechnicalAuditOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function FleetManagementOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const fleetManagementSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'gestao-frota',
    fleetManagementNavigationItems,
  )

  function handleFleetManagementSidebarSelect(key: string) {
    if (key !== FLEET_MANAGEMENT_OVERVIEW_KEY) return
    navigate(fleetManagementOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={FLEET_MANAGEMENT_OVERVIEW_KEY}
          areaId="gestao-frota"
          items={fleetManagementSidebarItems}
          onItemSelect={handleFleetManagementSidebarSelect}
        />
      }
      subtitle={fleetManagementOverviewSubtitle}
      title={fleetManagementOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <FleetManagementOverview />
      </Suspense>
    </DashboardLayout>
  )
}

function CustomerExperienceOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const customerExperienceSidebarItems = getAccessibleDepartmentSidebarItems(
    user,
    'experiencia-cliente',
    customerExperienceNavigationItems,
  )

  function handleCustomerExperienceSidebarSelect(key: string) {
    if (key !== CUSTOMER_EXPERIENCE_OVERVIEW_KEY) return
    navigate(customerExperienceOverviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <DepartmentAreaSidebar
          activeKey={CUSTOMER_EXPERIENCE_OVERVIEW_KEY}
          areaId="experiencia-cliente"
          items={customerExperienceSidebarItems}
          onItemSelect={handleCustomerExperienceSidebarSelect}
        />
      }
      subtitle={customerExperienceOverviewSubtitle}
      title={customerExperienceOverviewTitle}
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CustomerExperienceOverview />
      </Suspense>
    </DashboardLayout>
  )
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
