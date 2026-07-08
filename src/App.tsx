import { type ReactNode, useState } from 'react'

import { Categories } from './Pages/Categories'
import { ClosingReasons } from './Pages/ClosingReasons'
import { Customers } from './Pages/Customers'
import { DashboardLayout, type PageKey } from './Pages/Dashboard'
import { DimensionalModel } from './Pages/DimensionalModel'
import { Intelligence } from './Pages/Intelligence'
import { Login } from './Pages/Login'
import { OperationalCalendar } from './Pages/OperationalCalendar'
import { OrderStatus } from './Pages/OrderStatus'
import { Overview } from './Pages/Overview'
import { Permissions } from './Pages/Permissions'
import { Quality } from './Pages/Quality'
import { Resolutions } from './Pages/Resolutions'
import { Technicians } from './Pages/Technicians'
import { Temporal } from './Pages/Temporal'
import { Unproductive } from './Pages/Unproductive'
import { Users } from './Pages/Users'

const pageComponents: Record<PageKey, ReactNode> = {
  overview: <Overview />,
  temporal: <Temporal />,
  calendar: <OperationalCalendar />,
  status: <OrderStatus />,
  categories: <Categories />,
  resolutions: <Resolutions />,
  unproductive: <Unproductive />,
  closing: <ClosingReasons />,
  technicians: <Technicians />,
  customers: <Customers />,
  quality: <Quality />,
  intelligence: <Intelligence />,
  model: <DimensionalModel />,
  users: <Users />,
  permissions: <Permissions />,
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [activePage, setActivePage] = useState<PageKey>('overview')

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />
  }

  return (
    <DashboardLayout
      activePage={activePage}
      onLogout={() => {
        setAuthenticated(false)
        setActivePage('overview')
      }}
      onPageChange={setActivePage}
    >
      {pageComponents[activePage]}
    </DashboardLayout>
  )
}

export default App
