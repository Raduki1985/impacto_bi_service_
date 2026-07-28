export type UserProfile = 'Administrador' | 'Executivo' | 'Gestor'

export type UserStatus = 'Ativo' | 'Inativo'

export type DepartmentPageAccess = {
  departmentId: string
  pageKeys: string[]
}

export type UserAuditMetadata = {
  createdAt: string
  createdByUserId: string
  createdByName: string
  updatedAt?: string
  updatedByUserId?: string
  updatedByName?: string
  deactivatedAt?: string
  deactivatedByUserId?: string
  deactivatedByName?: string
  reactivatedAt?: string
  reactivatedByUserId?: string
  reactivatedByName?: string
}
