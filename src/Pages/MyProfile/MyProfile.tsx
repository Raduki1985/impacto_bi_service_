import {useAuth} from '../../contexts/useAuth'

export function MyProfile() {
    const {user} = useAuth()

    if (!user) return null

    const departments =
        user.profile === 'Analista' ? user.departments.join(', ') : 'Todos os departamentos'

    const fields = [
        {label: 'Nome completo', value: user.name},
        {label: 'E-mail corporativo', value: user.email},
        // `user.profile` é o papel funcional (Administrador, Executivo, Analista), e
        // não o Perfil de Acesso, que descreve departamentos e páginas: o rótulo
        // precisa dizer Perfil do Sistema para os dois não serem confundidos.
        {label: 'Perfil do Sistema', value: user.profile},
        {label: 'Status', value: user.status},
        {label: 'Departamentos', value: departments},
        {label: 'Último acesso', value: user.lastAccess},
    ]

    return (
        <div className="grid gap-5">
            <div>
                <h2 className="text-base font-bold text-[#1a2331]">Meu perfil</h2>
                <p className="mt-1 text-[13px] text-[#667085]">
                    Informações da conta e dos acessos vinculados ao portal.
                </p>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                    <div key={field.label} className="rounded-xl border border-[#e4e7ee] bg-white px-4 py-3">
                        <dt className="text-[11.5px] font-semibold uppercase text-[#667085]">{field.label}</dt>
                        <dd className="mt-1 break-words text-[14px] font-medium text-[#1a2331]">{field.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}
