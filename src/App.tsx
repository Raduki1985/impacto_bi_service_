import { lazy, Suspense, type ComponentType } from 'react'
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
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
import { useAuth } from './contexts/useAuth'
import { DashboardDataProvider } from './contexts/DashboardDataContext'
import { RequirePermission } from './components/routing/RequirePermission'
import { AreaSidebar, type AreaSidebarItem } from './components/navigation/AreaSidebar'
import { biAreas } from './config/biAreas'
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
  permissions: lazy(() => import('./Pages/Permissions').then((module) => ({ default: module.Permissions }))),
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

const corporateOverviewPath = '/dashboard/inicio'

const osSidebarItems: AreaSidebarItem[] = navigationGroups.reduce<AreaSidebarItem[]>(
  (acc, group) => [...acc, ...group.items],
  [],
)

function isPageKey(key: string): key is PageKey {
  return key in pageSlugs
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
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
            <Navigate replace to="/dashboard/configuracoes/meu-perfil" />
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
      <Route
        element={
          user ? (
            <RequirePermission permission={ADMIN_FULL_PERMISSION} redirectTo={corporateOverviewPath}>
              <Navigate replace to="/dashboard/configuracoes/permissoes" />
            </RequirePermission>
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/permissoes"
      />
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
  const activePage = pageFromSlug(pageSlug) ?? 'overview'
  const PageComponent = pageComponents[activePage]

  if (pageSlug && !pageFromSlug(pageSlug)) {
    return <Navigate replace to={corporateOverviewPath} />
  }

  const showOsSidebar = osSidebarItems.some((item) => item.key === activePage)

  function handleOsSidebarSelect(key: string) {
    if (!isPageKey(key)) return
    navigate(`/dashboard/os/${pageSlugs[key]}`)
  }

  function handlePageChange(page: PageKey) {
    if (page === 'users' || page === 'permissions') {
      navigate(`/dashboard/${pageSlugs[page]}`)
      return
    }
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
            <AreaSidebar
              activeKey={activePage}
              areaLabel="Ordens de Serviço"
              items={osSidebarItems}
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

function PortalSettingsRoute({ onLogout }: { onLogout: () => void }) {
  const params = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const configPage = params.configPage

  const canReadUsers = hasPermission(ADMIN_USERS_READ_PERMISSION)
  const isAdmin = hasPermission(ADMIN_FULL_PERMISSION)

  if (configPage !== 'meu-perfil' && configPage !== 'usuarios' && configPage !== 'permissoes') {
    return <Navigate replace to="/dashboard/configuracoes/meu-perfil" />
  }

  if (configPage === 'usuarios' && !canReadUsers) {
    return <Navigate replace to={corporateOverviewPath} />
  }

  if (configPage === 'permissoes' && !isAdmin) {
    return (
      <Navigate
        replace
        to={canReadUsers ? '/dashboard/configuracoes/usuarios' : corporateOverviewPath}
      />
    )
  }

  const SettingsPage =
    configPage === 'meu-perfil'
      ? MyProfile
      : configPage === 'usuarios'
        ? pageComponents.users
        : pageComponents.permissions

  const tabClasses = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'relative z-10 -mb-px inline-flex h-10 items-center rounded-t-lg border border-[#e4e7ee] border-b-white bg-white px-4 text-[13px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
      : 'inline-flex h-10 items-center rounded-t-lg border border-[#e4e7ee] bg-[#f4f6fa] px-4 text-[13px] font-medium text-[#667085] transition hover:bg-[#eef1f6] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

  return (
    <DashboardDataProvider>
      <DashboardLayout
        activePage={null}
        onLogout={onLogout}
        onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
        showPageHeader={false}
        subtitle="Configurações pessoais e administrativas do portal"
        title="Configurações"
      >
        <div className="relative">
          <div className="flex items-end gap-1">
            <NavLink className={tabClasses} to="/dashboard/configuracoes/meu-perfil">
              Meu perfil
            </NavLink>
            {canReadUsers ? (
              <NavLink className={tabClasses} to="/dashboard/configuracoes/usuarios">
                Usuários
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink className={tabClasses} to="/dashboard/configuracoes/permissoes">
                Permissões
              </NavLink>
            ) : null}
          </div>
          <div className="rounded-b-xl rounded-tr-xl border border-[#e4e7ee] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
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
        <AreaSidebar
          activeKey={COMMERCIAL_OVERVIEW_KEY}
          areaLabel="Comercial"
          items={commercialNavigationItems}
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
        <AreaSidebar
          activeKey={TECHNICAL_SUPPORT_OVERVIEW_KEY}
          areaLabel="Suporte Técnico"
          items={technicalSupportNavigationItems}
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
        <AreaSidebar
          activeKey={BILLING_OVERVIEW_KEY}
          areaLabel="Cobrança"
          items={billingNavigationItems}
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
        <AreaSidebar
          activeKey={EQUIPMENT_RETRIEVAL_OVERVIEW_KEY}
          areaLabel="Retiradas"
          items={equipmentRetrievalNavigationItems}
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
        <AreaSidebar
          activeKey={LOYALTY_OVERVIEW_KEY}
          areaLabel="Fidelização"
          items={loyaltyNavigationItems}
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
        <AreaSidebar
          activeKey={RETENTION_OVERVIEW_KEY}
          areaLabel="Retenção"
          items={retentionNavigationItems}
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
        <AreaSidebar
          activeKey={COP_OVERVIEW_KEY}
          areaLabel="COP"
          items={copNavigationItems}
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
        <AreaSidebar
          activeKey={TECHNICAL_AUDIT_OVERVIEW_KEY}
          areaLabel="Auditoria Técnica"
          items={technicalAuditNavigationItems}
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
        <AreaSidebar
          activeKey={FLEET_MANAGEMENT_OVERVIEW_KEY}
          areaLabel="Gestão de Frota"
          items={fleetManagementNavigationItems}
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
        <AreaSidebar
          activeKey={CUSTOMER_EXPERIENCE_OVERVIEW_KEY}
          areaLabel="Experiência do Cliente"
          items={customerExperienceNavigationItems}
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
  const { hasPermission } = useAuth()

  const availableAreas = biAreas.filter(
    (area) => area.requiredPermission === null || hasPermission(area.requiredPermission),
  )

  const executiveSidebarItems: AreaSidebarItem[] = availableAreas.map((area) => ({
    key: area.id,
    label: area.label,
    icon: Building2,
  }))

  function handleExecutiveSidebarSelect(key: string) {
    const area = availableAreas.find((item) => item.id === key)
    if (!area) return
    navigate(area.overviewPath)
  }

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      sidebar={
        <AreaSidebar
          activeKey={null}
          areaLabel="Departamentos"
          items={executiveSidebarItems}
          onItemSelect={handleExecutiveSidebarSelect}
        />
      }
      title="Visão Geral Executiva"
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CorporateOverview />
      </Suspense>
    </DashboardLayout>
  )
}

export default App
