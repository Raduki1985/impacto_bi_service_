import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../contexts/useAuth'

type RequirePermissionProps = {
  permission: string
  redirectTo: string
  children: ReactNode
}

export function RequirePermission({ permission, redirectTo, children }: RequirePermissionProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(permission)) {
    return <Navigate replace to={redirectTo} />
  }

  return <>{children}</>
}
