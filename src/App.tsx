import {type ComponentType, lazy, Suspense, useCallback, useEffect, useState} from 'react'
import {
    BrowserRouter,
    Navigate,
    NavLink,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
    useSearchParams,
} from 'react-router-dom'
import {
    CircleDollarSign,
    ClipboardCheck,
    Handshake,
    Headset,
    HeartHandshake,
    type LucideIcon,
    MessagesSquare,
    PackageMinus,
    Radar,
    Truck,
    UserRoundCheck,
    Wrench,
} from 'lucide-react'

import {DashboardLayout, type PageKey} from './Pages/Dashboard'
import {navigationGroups, pageFromSlug, pageSlugs} from './Pages/Dashboard/pageConfig'
import {
    COMMERCIAL_ACCESS_PERMISSION,
    COMMERCIAL_OVERVIEW_KEY,
    commercialNavigationItems,
    commercialOverviewPath,
    commercialOverviewSubtitle,
    commercialOverviewTitle,
} from './Pages/Commercial/pageConfig'
import {COMMERCIAL_GOALS_PAGE_KEY, COMMERCIAL_GOALS_UPDATED_AT,} from './Pages/Commercial/Goals/goalsPageMeta'
import {
    COMMERCIAL_SALES_PERIOD_PAGE_KEY,
    COMMERCIAL_SALES_PERIOD_UPDATED_AT,
} from './Pages/Commercial/SalesPeriod/salesPeriodPageMeta'
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
import {Login, LoginSuccessToast, LogoutSuccessToast} from './Pages/Login'
import {DefinePassword, type DefinePasswordMode, ForgotPassword} from './Pages/Auth'
import {AuthProvider} from './contexts/AuthContext'
import {PreferencesProvider} from './contexts/PreferencesContext'
import {useAuth} from './contexts/useAuth'
import {usePreferences} from './contexts/usePreferences'
import {DashboardDataProvider} from './contexts/DashboardDataContext'
import {OS_DATA_UPDATED_AT} from './data/mockOsCatalog'
import {UpcomingDashboard} from './Pages/DepartmentPage'
import type {AuthUser} from './types/user/userTypes'
import {RequirePermission} from './components/routing/RequirePermission'
import {UpdateAvailableToast} from './components/ui/UpdateAvailableToast'
import {useVersionCheck} from './components/ui/useVersionCheck'
import {AreaSidebar, type AreaSidebarItem} from './components/navigation/AreaSidebar'
import {
    firstAccessibleDepartmentPageKey,
    getAccessibleBiAreas,
    getDepartmentPageAccessState,
} from './lib/accessControl'
import {
    departmentPageKeyFromPath,
    departmentPagePath,
    findDepartmentIdBySlug,
    findDepartmentPageByKey,
    findDepartmentPageBySlug,
} from './lib/departmentPageRoutes'
import {
    departmentEntryPath,
    resolveHomePath,
    shouldDiscardHomeDepartment,
    usesCorporateHome,
} from './lib/homeNavigation'
import {getAccessibleDepartmentSidebarItems} from './lib/sidebarAccess'
import {
    resolveSettingsOriginPathname,
    SETTINGS_ENTRY_PATH,
    SETTINGS_PROFILE_PATH,
    settingsReturnState,
} from './lib/settingsNavigation'
import {OVERVIEW_PAGE_KEY} from './lib/userAccessRules'
import {type BiArea, type BiAreaId, biAreas, getActiveBiArea} from './config/biAreas'
import {
    ADMIN_FULL_PERMISSION,
    ADMIN_USERS_READ_PERMISSION,
    ORDERS_SERVICE_ACCESS_PERMISSION,
} from './config/permissions'

const pageComponents: Record<PageKey, React.LazyExoticComponent<ComponentType>> = {
    overview: lazy(() => import('./Pages/Overview').then((module) => ({default: module.Overview}))),
    temporal: lazy(() => import('./Pages/Temporal').then((module) => ({default: module.Temporal}))),
    calendar: lazy(() => import('./Pages/OperationalCalendar').then((module) => ({default: module.OperationalCalendar}))),
    status: lazy(() => import('./Pages/OrderStatus').then((module) => ({default: module.OrderStatus}))),
    categories: lazy(() => import('./Pages/Categories').then((module) => ({default: module.Categories}))),
    resolutions: lazy(() => import('./Pages/Resolutions').then((module) => ({default: module.Resolutions}))),
    unproductive: lazy(() => import('./Pages/Unproductive').then((module) => ({default: module.Unproductive}))),
    closing: lazy(() => import('./Pages/ClosingReasons').then((module) => ({default: module.ClosingReasons}))),
    technicians: lazy(() => import('./Pages/Technicians').then((module) => ({default: module.Technicians}))),
    customers: lazy(() => import('./Pages/Customers').then((module) => ({default: module.Customers}))),
    quality: lazy(() => import('./Pages/Quality').then((module) => ({default: module.Quality}))),
    intelligence: lazy(() => import('./Pages/Intelligence').then((module) => ({default: module.Intelligence}))),
    model: lazy(() => import('./Pages/DimensionalModel').then((module) => ({default: module.DimensionalModel}))),
    users: lazy(() => import('./Pages/Users').then((module) => ({default: module.Users}))),
    history: lazy(() =>
        import('./Pages/UserHistory').then((module) => ({
            default: module.UserHistory,
        })),
    ),
}

const CommercialOverview = lazy(() =>
    import('./Pages/Commercial/Overview').then((module) => ({default: module.Overview})),
)

const CommercialGoals = lazy(() =>
    import('./Pages/Commercial/Goals').then((module) => ({default: module.Goals})),
)

const CommercialSalesPeriod = lazy(() =>
    import('./Pages/Commercial/SalesPeriod').then((module) => ({default: module.SalesPeriod})),
)

const TechnicalSupportOverview = lazy(() =>
    import('./Pages/TechnicalSupport/Overview').then((module) => ({default: module.Overview})),
)

const BillingOverview = lazy(() =>
    import('./Pages/Billing/Overview').then((module) => ({default: module.Overview})),
)

const EquipmentRetrievalOverview = lazy(() =>
    import('./Pages/EquipmentRetrieval/Overview').then((module) => ({default: module.Overview})),
)

const LoyaltyOverview = lazy(() =>
    import('./Pages/Loyalty/Overview').then((module) => ({default: module.Overview})),
)

const RetentionOverview = lazy(() =>
    import('./Pages/Retention/Overview').then((module) => ({default: module.Overview})),
)

const CopOverview = lazy(() =>
    import('./Pages/Cop/Overview').then((module) => ({default: module.Overview})),
)

const TechnicalAuditOverview = lazy(() =>
    import('./Pages/TechnicalAudit/Overview').then((module) => ({default: module.Overview})),
)

const FleetManagementOverview = lazy(() =>
    import('./Pages/FleetManagement/Overview').then((module) => ({default: module.Overview})),
)

const CustomerExperienceOverview = lazy(() =>
    import('./Pages/CustomerExperience/Overview').then((module) => ({default: module.Overview})),
)

const CorporateOverview = lazy(() =>
    import('./Pages/CorporateOverview').then((module) => ({default: module.CorporateOverview})),
)

const MyProfile: React.LazyExoticComponent<ComponentType> = lazy(() =>
    import('./Pages/MyProfile').then((module) => ({default: module.MyProfile})),
)

const Preferences: React.LazyExoticComponent<ComponentType> = lazy(() =>
    import('./Pages/Preferences').then((module) => ({default: module.Preferences})),
)

const AccessProfilesPreview: React.LazyExoticComponent<ComponentType> = lazy(() =>
    import('./Pages/AccessProfiles').then((module) => ({
        default: module.AccessProfiles,
    })),
)

const MenuItems: React.LazyExoticComponent<ComponentType> = lazy(() =>
    import('./Pages/MenuItems').then((module) => ({default: module.MenuItems})),
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
    'menu-itens': MenuItems,
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
    cop: {Component: CopOverview, title: copOverviewTitle, subtitle: copOverviewSubtitle},
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

/**
 * Página departamental que já tem dashboard próprio, fora a Visão Geral.
 *
 * Registro indexado pelo par departamento e página, exatamente o mesmo par que
 * o modelo de acesso usa. Uma página que não está aqui continua renderizando o
 * `UpcomingDashboard`, e entrar nesta lista não concede acesso nenhum: a rota, a
 * permissão do departamento e `getDepartmentPageAccessState` continuam
 * decidindo antes.
 *
 * `updatedAt` existe porque a base de cada dashboard tem data própria. Sem ele,
 * o cabeçalho mantém a data padrão que já exibia.
 */
type DepartmentSpecializedPage = {
    Component: React.LazyExoticComponent<ComponentType>
    updatedAt?: string
}

const departmentSpecializedPages: Partial<
    Record<BiAreaId, Record<string, DepartmentSpecializedPage>>
> = {
    comercial: {
        [COMMERCIAL_SALES_PERIOD_PAGE_KEY]: {
            Component: CommercialSalesPeriod,
            updatedAt: COMMERCIAL_SALES_PERIOD_UPDATED_AT,
        },
        [COMMERCIAL_GOALS_PAGE_KEY]: {
            Component: CommercialGoals,
            updatedAt: COMMERCIAL_GOALS_UPDATED_AT,
        },
    },
}

function App() {
    return (
        <BrowserRouter>
            <PreferencesProvider>
                <AuthProvider>
                    <Portal/>
                </AuthProvider>
            </PreferencesProvider>
        </BrowserRouter>
    )
}

/**
 * O portal inteiro: as rotas, mais o que precisa sobreviver à troca delas.
 *
 * Existe por causa dos avisos das duas pontas da sessão. Entrar e sair trocam a
 * rota no mesmo instante, e a tela de origem sai da árvore junto: um aviso
 * desenhado por ela apareceria e sumiria no mesmo quadro. Aqui fora ele
 * atravessa a troca e é lido já na tela de destino — a entrada sobre o painel,
 * a saída sobre o login.
 *
 * Cada aviso exige mais do que a própria notícia: o de entrada exige `user`, e
 * o de saída exige a AUSÊNCIA dele. É essa exigência, e não um cancelamento
 * cruzado, que impede os dois na tela ao mesmo tempo e apaga cada um quando a
 * sessão vira do outro lado: quem saiu não continua vendo a confirmação de uma
 * entrada que já acabou, e quem entrou de novo não vê a da saída anterior.
 *
 * O aviso de VERSÃO NOVA mora aqui pelo mesmo motivo de sobrevivência, e por
 * mais um: ele nasce de um relógio que só faz sentido correndo uma vez por
 * aba, durante a sessão inteira. Dentro das rotas, cada troca de página
 * reiniciaria a contagem, e quem navega bastante nunca chegaria ao primeiro
 * ciclo.
 *
 * `useCallback` nos fechar não é enfeite: o aviso conta os próprios segundos em
 * um efeito que depende dessa função, e uma função nova a cada renderização
 * reiniciaria a contagem sempre que qualquer coisa aqui mudasse.
 */
function Portal() {
    const {user} = useAuth()
    const [loginSucceeded, setLoginSucceeded] = useState(false)
    const [logoutSucceeded, setLogoutSucceeded] = useState(false)
    const dismissLoginToast = useCallback(() => setLoginSucceeded(false), [])
    const dismissLogoutToast = useCallback(() => setLogoutSucceeded(false), [])
    const publishedVersion = useVersionCheck()

    return (
        <>
            <AppRoutes
                onLoginSuccess={() => setLoginSucceeded(true)}
                onLogoutSuccess={() => setLogoutSucceeded(true)}
            />
            {loginSucceeded && user ? (
                <LoginSuccessToast onDismiss={dismissLoginToast} userName={user.name}/>
            ) : null}
            {logoutSucceeded && !user ? <LogoutSuccessToast onDismiss={dismissLogoutToast}/> : null}
            {publishedVersion ? <UpdateAvailableToast version={publishedVersion}/> : null}
        </>
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
    const {user} = useAuth()
    const {clearHomeDepartmentId, homeDepartmentIdFor} = usePreferences()

    const userId = user?.id ?? null
    const discard = shouldDiscardHomeDepartment(
        user,
        userId === null ? null : homeDepartmentIdFor(userId),
    )

    useEffect(() => {
        if (userId !== null && discard) clearHomeDepartmentId(userId)
    }, [clearHomeDepartmentId, discard, userId])
}

/**
 * As rotas do portal.
 *
 * `onLoginSuccess` e `onLogoutSuccess` apenas AVISAM que a entrada pelo
 * formulário foi aceita e que a saída foi concluída. Quem decide o que fazer
 * com essas notícias é o `Portal`, porque a tela de origem sai da árvore na
 * mesma hora e nada desenhado por aqui dentro sobreviveria à troca de rota.
 */
function AppRoutes({
                       onLoginSuccess,
                       onLogoutSuccess,
                   }: {
    onLoginSuccess: () => void
    onLogoutSuccess: () => void
}) {
    const {user, login, logout} = useAuth()
    const {homeDepartmentIdFor} = usePreferences()
    const navigate = useNavigate()

    useDiscardedHomeDepartment()

    /**
     * A confirmação do Sair já foi colhida pelo menu do usuário: aqui a sessão
     * acaba de fato.
     *
     * O aviso é disparado por último, mas no MESMO evento: o React aplica as
     * três mudanças juntas, e a tela de login já nasce com a confirmação em vez
     * de recebê-la no quadro seguinte.
     */
    const handleLogout = () => {
        logout()
        navigate('/login')
        onLogoutSuccess()
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
                        <Navigate replace to={homePath}/>
                    ) : (
                        <Login
                            onForgotPassword={() => navigate('/forgot-password')}
                            onLogin={async (email, password) => {
                                const result = await login(email, password)
                                // O usuário autenticado só existe na renderização seguinte, então
                                // a entrada passa pela Página Inicial, que aplica a mesma regra
                                // central e encaminha o Analista sem renderizar a Visão Geral
                                // Executiva.
                                if (result.ok) {
                                    onLoginSuccess()
                                    navigate(corporateOverviewPath)
                                }
                                // O motivo segue para a tela: ela distingue cadastro de Perfil de
                                // Acesso, e este ponto não escolhe mensagem nenhuma.
                                return result
                            }}
                        />
                    )
                }
                path="/login"
            />
            {/* Pedido de recuperação: pública, e fechada para quem já está
          autenticado, exatamente como /login. Quem tem sessão aberta não
          precisa de link por e-mail, e a tela não pede senha nenhuma. */}
            <Route
                element={
                    user ? (
                        <Navigate replace to={homePath}/>
                    ) : (
                        <ForgotPassword onBackToLogin={() => navigate('/login')}/>
                    )
                }
                path="/forgot-password"
            />
            {/* As duas telas de link por e-mail NÃO olham a sessão: quem manda é o
          token da URL, e ele pode chegar em um navegador onde outra pessoa
          está autenticada. Redirecionar aqui deixaria o link inútil. */}
            <Route element={<DefinePasswordRoute mode="first-access"/>} path="/set-password"/>
            <Route element={<DefinePasswordRoute mode="reset"/>} path="/reset-password"/>
            <Route
                element={user ? <Navigate replace to={homePath}/> : <Navigate replace to="/login"/>}
                path="/"
            />
            <Route
                element={user ? <Navigate replace to={homePath}/> : <Navigate replace to="/login"/>}
                path="/dashboard"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/visao-geral"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/visao-geral"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/temporal"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/temporal"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/calendario"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/calendario"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/status"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/status"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/categorias"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/categorias"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/resolucoes"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/resolucoes"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/improdutividade"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/improdutividade"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/fechamento"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/fechamento"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/tecnicos"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/tecnicos"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/clientes"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/clientes"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/qualidade"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/qualidade"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/inteligencia"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/inteligencia"
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to="/dashboard/os/modelo"/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/modelo"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout}/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/:pageSlug"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="visao-geral"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/visao-geral"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="temporal"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/temporal"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="calendario"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/calendario"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="status"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/status"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="categorias"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/categorias"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="resolucoes"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/resolucoes"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="improdutividade"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/improdutividade"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="fechamento"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/fechamento"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="tecnicos"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/tecnicos"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="clientes"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/clientes"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="qualidade"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/qualidade"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="inteligencia"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/os/inteligencia"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ORDERS_SERVICE_ACCESS_PERMISSION}
                                           redirectTo={corporateOverviewPath}>
                            <DashboardRoute onLogout={handleLogout} pageSlug="modelo"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <Navigate replace to="/login"/>
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
                        <DepartmentPageRoute onLogout={handleLogout}/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/:departmentSlug/:pageSlug"
            />
            <Route
                element={
                    user ? <HomeRoute onLogout={handleLogout}/> : <Navigate replace to="/login"/>
                }
                path={corporateOverviewPath}
            />
            <Route
                element={
                    user ? (
                        <Navigate replace to={SETTINGS_ENTRY_PATH}/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/configuracoes"
            />
            <Route
                element={
                    user ? (
                        <PortalSettingsRoute onLogout={handleLogout}/>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/configuracoes/:configPage"
            />
            <Route
                element={
                    user ? (
                        <RequirePermission permission={ADMIN_USERS_READ_PERMISSION} redirectTo={corporateOverviewPath}>
                            <Navigate replace to="/dashboard/configuracoes/usuarios"/>
                        </RequirePermission>
                    ) : (
                        <Navigate replace to="/login"/>
                    )
                }
                path="/dashboard/usuarios"
            />
            {/* O Histórico não tem rota legada em /dashboard: sua única URL oficial é
          /dashboard/configuracoes/historico. */}
            <Route element={<Navigate replace to="/"/>} path="*"/>
        </Routes>
    )
}

/**
 * Tela de definição de senha, com o token lido da query da URL.
 *
 * O serviço monta os dois links como `/set-password?token=` e
 * `/reset-password?token=`, e é daí que o código sai. Token ausente ou em branco
 * vira `null`, e a tela mostra que o link chegou incompleto em vez de enviar um
 * pedido que o serviço recusaria com 401.
 */
function DefinePasswordRoute({mode}: { mode: DefinePasswordMode }) {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const token = searchParams.get('token')?.trim() ?? ''

    return (
        <DefinePassword
            mode={mode}
            onGoToLogin={() => navigate('/login')}
            token={token === '' ? null : token}
        />
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
    const {user} = useAuth()
    const activePage = pageFromSlug(pageSlug) ?? 'overview'
    const PageComponent = pageComponents[activePage]

    if (pageSlug && !pageFromSlug(pageSlug)) {
        return <Navigate replace to={corporateOverviewPath}/>
    }

    // Usuários e Histórico são páginas das Configurações, não de Ordens de
    // Serviço: a rota genérica não pode renderizá-las. A verificação vem antes do
    // acesso departamental, que só descreve páginas de OS.
    if (activePage === 'users' || activePage === 'history') {
        return <Navigate replace to={corporateOverviewPath}/>
    }

    const activePageAccessState = getDepartmentPageAccessState(user, 'os', activePage)

    /**
     * Só a página habilitada renderiza: sem permissão ou em desenvolvimento, cai na
     * página de ENTRADA de Ordens de Serviço — a primeira concedida, que nem sempre
     * é a Visão Geral desde que ela deixou de ser imposta. Sem nenhuma página
     * utilizável em OS, o destino é a Página Inicial.
     */
    if (activePageAccessState !== 'enabled') {
        const entryPath = departmentEntryPath(user, 'os')

        if (entryPath !== null && entryPath !== departmentPagePath('os', activePage)) {
            return <Navigate replace to={entryPath}/>
        }

        return <Navigate replace to={corporateOverviewPath}/>
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
                // Data da base de OS (investigação do SGI); as páginas de outros
                // departamentos continuam com as próprias datas.
                updatedAt={OS_DATA_UPDATED_AT}
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
                {/* Os sete filtros deste bloco pertencem só à Visão Geral: o painel e o
            provedor deles vivem dentro da própria página. As demais páginas de
            OS seguem sem painel de filtros e com a simulação intacta, até cada
            uma ganhar um bloco próprio. */}
                <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
                    <PageComponent/>
                </Suspense>
            </DashboardLayout>
        </DashboardDataProvider>
    )
}

/**
 * Departamentos que o usuário pode abrir.
 *
 * A pergunta é feita pelos VÍNCULOS do usuário, em `getAccessibleBiAreas`, e não
 * mais por `requiredPermission` e `hasPermission`. As duas respostas coincidem
 * — a permissão de departamento é derivada dos mesmos vínculos —, mas a lista
 * precisa da mesma fonte que monta os itens da barra lateral, para nunca oferecer
 * um departamento cujas páginas o portal recusaria em seguida.
 */
function useAccessibleBiAreas(): BiArea[] {
    const {user} = useAuth()

    return getAccessibleBiAreas(user)
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

/**
 * Itens da lista de dashboards.
 *
 * O departamento fica BLOQUEADO quando nenhuma das páginas concedidas nele está
 * disponível — só sobraram páginas em desenvolvimento. Ele continua visível
 * porque foi concedido de verdade, e o bloqueio usa a mesma linguagem visual das
 * páginas em desenvolvimento, em vez de um item que aceita o clique e não sai do
 * lugar por falta de destino.
 */
function biAreaSidebarItems(areas: BiArea[], user: AuthUser | null): AreaSidebarItem[] {
    return areas.map((area) => ({
        key: area.id,
        label: area.label,
        icon: biAreaIcons[area.id],
        title: area.label,
        disabled: firstAccessibleDepartmentPageKey(user, area.id) === null,
    }))
}

/**
 * Navegação para a página de entrada de um departamento da lista.
 *
 * O destino vem de `departmentEntryPath`, e não de `area.overviewPath`: a Visão
 * Geral não é mais imposta a todo departamento concedido, então um departamento
 * em que só `status` foi concedido abre em Status. Sem destino, nada acontece —
 * o item já está bloqueado por `biAreaSidebarItems`.
 */
function useDepartmentEntryNavigation(availableAreas: BiArea[]): (key: string) => boolean {
    const navigate = useNavigate()
    const {user} = useAuth()

    return (key: string) => {
        const area = availableAreas.find((item) => item.id === key)
        if (!area) return false

        const path = departmentEntryPath(user, area.id)
        if (path === null) return false

        navigate(path)

        return true
    }
}

function DepartmentNavigationSidebar() {
    const {user} = useAuth()
    const availableAreas = useAccessibleBiAreas()
    const openDepartment = useDepartmentEntryNavigation(availableAreas)

    return (
        <AreaSidebar
            activeKey={null}
            areaLabel="Dashboards"
            items={biAreaSidebarItems(availableAreas, user)}
            onItemSelect={openDepartment}
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
    const {user} = useAuth()
    const availableAreas = useAccessibleBiAreas()
    const openDepartment = useDepartmentEntryNavigation(availableAreas)
    const [showDepartments, setShowDepartments] = useState(false)

    function handleDepartmentSelect(key: string) {
        // O modo só volta para a lista de páginas quando houve navegação de fato.
        if (openDepartment(key)) setShowDepartments(false)
    }

    if (showDepartments) {
        return (
            <AreaSidebar
                activeKey={areaId}
                areaLabel="Dashboards"
                items={biAreaSidebarItems(availableAreas, user)}
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
function SettingsOriginSidebar({originPathname}: { originPathname: string }) {
    const navigate = useNavigate()
    const {user} = useAuth()
    const area = getActiveBiArea(originPathname)

    // Visão Geral Executiva ou acesso direto sem origem válida: contexto de departamentos.
    if (!area) return <DepartmentNavigationSidebar/>

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

function PortalSettingsRoute({onLogout}: { onLogout: () => void }) {
    const params = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const {hasPermission} = useAuth()
    const configPage = params.configPage

    const canReadUsers = hasPermission(ADMIN_USERS_READ_PERMISSION)
    const isAdmin = hasPermission(ADMIN_FULL_PERMISSION)

    // Repassado em toda navegação interna para não perder a página de origem.
    const returnState = settingsReturnState(location)
    const originPathname = resolveSettingsOriginPathname(location.state)

    // Qualquer slug fora da lista de abas cai aqui, sem renderizar nenhuma página.
    if (!isSettingsPageSlug(configPage)) {
        return <Navigate replace state={returnState} to={SETTINGS_PROFILE_PATH}/>
    }

    if (configPage === 'usuarios' && !canReadUsers) {
        return <Navigate replace to={corporateOverviewPath}/>
    }

    // Histórico, Perfis de acesso e Menu Itens são exclusivos do Administrador.
    // Menu Itens entra na mesma regra porque suas rotas de escrita no serviço
    // estão atrás de `require_admin`: oferecer a aba a quem só lê usuários
    // renderizaria uma tela cujas ações o serviço recusaria.
    // Quem só lê usuários volta para a aba de Usuários; sem nem isso, sai das
    // Configurações.
    if (
        (configPage === 'historico' ||
            configPage === 'perfis-acesso' ||
            configPage === 'menu-itens') &&
        !isAdmin
    ) {
        return canReadUsers ? (
            <Navigate replace state={returnState} to="/dashboard/configuracoes/usuarios"/>
        ) : (
            <Navigate replace to={corporateOverviewPath}/>
        )
    }

    const SettingsPage = settingsPageComponents[configPage]

    const tabClasses = ({isActive}: { isActive: boolean }) =>
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
                sidebar={<SettingsOriginSidebar originPathname={originPathname}/>}
                subtitle="Configurações pessoais e administrativas do portal"
                title="Configurações"
            >
                {/* Coluna presa à altura da área central: o painel branco herda a sobra e
            nunca empurra a página, então o rodapé fica no mesmo lugar em toda aba. */}
                <div className="relative flex h-full flex-col">
                    <div className="flex flex-none items-end gap-1">
                        {/* Meu perfil, Preferências e Histórico saíram da barra de
                            abas, comentados e não removidos: as páginas e as rotas
                            delas continuam de pé, e reativar cada aba é descomentar o
                            NavLink correspondente.

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
                        */}
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
                        {/* Menu Itens vem logo depois de Perfis de acesso, e não no
                            fim: as duas abas tratam da mesma estrutura, e é aqui que
                            se cadastra o que lá se concede. */}
                        {isAdmin ? (
                            <NavLink
                                className={tabClasses}
                                state={returnState}
                                to="/dashboard/configuracoes/menu-itens"
                            >
                                Menu Itens
                            </NavLink>
                        ) : null}
                        {/* Histórico comentado junto com as outras duas. A página
                            dele já não tem função nenhuma: o registro que era gravado
                            no `localStorage` do navegador foi removido, e a auditoria
                            só volta quando o `impacto-bi-service` a expuser.

                            {isAdmin ? (
                                <NavLink
                                    className={tabClasses}
                                    state={returnState}
                                    to="/dashboard/configuracoes/historico"
                                >
                                    Histórico
                                </NavLink>
                            ) : null}
                        */}
                    </div>
                    {/* Painel e rolagem separados de propósito. Enquanto o próprio painel
              rolava, a barra era desenhada na borda dele: ela nascia colada à
              borda arredondada, passava por cima do respiro interno e cortava os
              cantos. Agora o painel só desenha borda, cantos e fundo, com
              overflow-hidden para recortar a barra nos cantos, e quem rola é a
              camada de dentro, que leva o respiro junto. A barra passa a viver
              dentro do painel, e continua visível. */}
                    <div
                        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl rounded-tr-xl border border-[#e4e7ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
                            <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
                                <SettingsPage/>
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
    const {hasPermission, user} = useAuth()

    const areaId = areaIdProp ?? findDepartmentIdBySlug(params.departmentSlug)
    const area = areaId === null ? null : (biAreas.find((item) => item.id === areaId) ?? null)

    const page =
        area === null || area.id === 'os'
            ? null
            : pageKeyProp === undefined
                ? findDepartmentPageBySlug(area.id, params.pageSlug)
                : findDepartmentPageByKey(area.id, pageKeyProp)

    if (area === null || page === null) return <Navigate replace to={corporateOverviewPath}/>

    if (area.requiredPermission !== null && !hasPermission(area.requiredPermission)) {
        return <Navigate replace to={corporateOverviewPath}/>
    }

    /** Caminho canônico da página pedida, para o consolo nunca apontar para ela mesma. */
    const fullPath = departmentPagePath(area.id, page.key)

    if (getDepartmentPageAccessState(user, area.id, page.key) !== 'enabled') {
        /**
         * O consolo é a página de ENTRADA do departamento, e não a Visão Geral: ela
         * deixou de ser imposta a todo departamento concedido, então quem recebeu
         * apenas `status` é mandado para Status, e não para fora do departamento.
         * Sem nenhuma página utilizável ali, o destino é a Página Inicial.
         */
        const entryPath = departmentEntryPath(user, area.id)

        if (entryPath !== null && entryPath !== fullPath) {
            return <Navigate replace to={entryPath}/>
        }

        return <Navigate replace to={corporateOverviewPath}/>
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
    const specializedPage = isOverview
        ? null
        : (departmentSpecializedPages[departmentId]?.[page.key] ?? null)

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
            updatedAt={specializedPage?.updatedAt}
        >
            <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
                {isOverview ? (
                    <overview.Component/>
                ) : specializedPage ? (
                    <specializedPage.Component/>
                ) : (
                    <UpcomingDashboard departmentLabel={area.label} pageLabel={page.label}/>
                )}
            </Suspense>
        </DashboardLayout>
    )
}

/**
 * Página Inicial do portal.
 *
 * É a única porta de `/dashboard/inicio`, e é ela que impede a Visão Geral
 * Executiva de aparecer para quem não deve vê-la. Com a página desligada,
 * `usesCorporateHome` responde false a todo mundo e a rota só encaminha: cada
 * usuário vai para a Visão Geral do departamento inicial efetivo, ou para o
 * destino seguro quando não tem nenhuma concedida. Religada a página, os perfis
 * previstos voltam a renderizá-la por este mesmo caminho.
 *
 * Concentrar a decisão aqui também conserta os redirecionamentos que já
 * existiam: todo `redirectTo` do portal aponta para esta rota, então quem for
 * recusado em qualquer página cai na Página Inicial dele. O encaminhamento
 * acontece antes de qualquer renderização, sem piscar a página executiva e sem
 * criar ciclo: o destino é sempre uma rota diferente desta.
 */
function HomeRoute({onLogout}: { onLogout: () => void }) {
    const {user} = useAuth()
    const {homeDepartmentIdFor} = usePreferences()

    if (!usesCorporateHome(user)) {
        return <Navigate replace to={resolveHomePath(user, user ? homeDepartmentIdFor(user.id) : null)}/>
    }

    return <CorporateOverviewRoute onLogout={onLogout}/>
}

function CorporateOverviewRoute({onLogout}: { onLogout: () => void }) {
    const navigate = useNavigate()

    return (
        <DashboardLayout
            activePage={null}
            onLogout={onLogout}
            onPageChange={(page) => navigate(`/dashboard/${pageSlugs[page]}`)}
            sidebar={<DepartmentNavigationSidebar/>}
            subtitle="Indicadores executivos consolidados de todos os departamentos"
            title="Visão Geral Executiva"
        >
            <Suspense fallback={<div className="text-[13px] text-[#667085]">Carregando painel...</div>}>
                <CorporateOverview/>
            </Suspense>
        </DashboardLayout>
    )
}

export default App
