import { lazy, Suspense, type ComponentType } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

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
import { Login } from './Pages/Login'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { DashboardDataProvider } from './contexts/DashboardDataContext'
import { RequirePermission } from './components/routing/RequirePermission'
import { AreaSidebar, type AreaSidebarItem } from './components/navigation/AreaSidebar'

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

const CorporateOverview = lazy(() =>
  import('./Pages/CorporateOverview').then((module) => ({ default: module.CorporateOverview })),
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
            <DashboardRoute onLogout={handleLogout} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/:pageSlug"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="visao-geral" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/visao-geral"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="temporal" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/temporal"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="calendario" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/calendario"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="status" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/status"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="categorias" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/categorias"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="resolucoes" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/resolucoes"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="improdutividade" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/improdutividade"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="fechamento" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/fechamento"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="tecnicos" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/tecnicos"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="clientes" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/clientes"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="qualidade" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/qualidade"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="inteligencia" />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/os/inteligencia"
      />
      <Route
        element={
          user ? (
            <DashboardRoute onLogout={handleLogout} pageSlug="modelo" />
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
            <CorporateOverviewRoute onLogout={handleLogout} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path={corporateOverviewPath}
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

function CorporateOverviewRoute({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()

  return (
    <DashboardLayout
      activePage={null}
      onLogout={onLogout}
      onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      title="Visão Geral Corporativa"
    >
      <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
        <CorporateOverview />
      </Suspense>
    </DashboardLayout>
  )
}

export default App
