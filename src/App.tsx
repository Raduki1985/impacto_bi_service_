import { lazy, Suspense, useState, type ComponentType } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { DashboardLayout, type PageKey } from './Pages/Dashboard'
import { pageFromSlug, pageSlugs } from './Pages/Dashboard/pageConfig'
import { Login } from './Pages/Login'
import { DashboardDataProvider } from './contexts/DashboardDataContext'

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

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const [authenticated, setAuthenticated] = useState(false)
  const navigate = useNavigate()

  return (
    <Routes>
      <Route
        element={
          authenticated ? (
            <Navigate replace to={`/dashboard/${pageSlugs.overview}`} />
          ) : (
            <Login
              onLogin={() => {
                setAuthenticated(true)
                navigate(`/dashboard/${pageSlugs.overview}`)
              }}
            />
          )
        }
        path="/login"
      />
      <Route
        element={
          authenticated ? (
            <Navigate replace to={`/dashboard/${pageSlugs.overview}`} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/"
      />
      <Route
        element={
          authenticated ? (
            <Navigate replace to={`/dashboard/${pageSlugs.overview}`} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard"
      />
      <Route
        element={
          authenticated ? (
            <DashboardRoute
              onLogout={() => {
                setAuthenticated(false)
                navigate('/login')
              }}
            />
          ) : (
            <Navigate replace to="/login" />
          )
        }
        path="/dashboard/:pageSlug"
      />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

function DashboardRoute({ onLogout }: { onLogout: () => void }) {
  const { pageSlug } = useParams()
  const navigate = useNavigate()
  const activePage = pageFromSlug(pageSlug) ?? 'overview'
  const PageComponent = pageComponents[activePage]

  if (pageSlug && !pageFromSlug(pageSlug)) {
    return <Navigate replace to={`/dashboard/${pageSlugs.overview}`} />
  }

  return (
    <DashboardDataProvider>
      <DashboardLayout
        activePage={activePage}
        onLogout={onLogout}
        onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
      >
        <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
          <PageComponent />
        </Suspense>
      </DashboardLayout>
    </DashboardDataProvider>
  )
}

export default App
