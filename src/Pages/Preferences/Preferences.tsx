import {useId} from 'react'

import {biAreas} from '../../config/biAreas'
import {useAuth} from '../../contexts/useAuth'
import {usePreferences} from '../../contexts/usePreferences'
import {accessibleHomeDepartmentIds, canChooseHomeDepartment, resolveHomeDepartmentId,} from '../../lib/homeNavigation'

/**
 * Preferências do portal.
 *
 * Hoje a área tem uma única preferência real, e ela só existe para quem tem uma
 * escolha a fazer: o departamento inicial de quem começa por um departamento e
 * tem mais de um permitido. Administradores, Executivos e quem tem um
 * departamento só não veem seletor nenhum, porque não há o que escolher.
 *
 * A página não decide acesso e não amplia acesso: os departamentos oferecidos
 * são exatamente os que `lib/homeNavigation` já reconhece como permitidos, pelo
 * par `departmentId + pageKey`, e a página dentro do departamento é sempre a
 * Visão Geral.
 */

/**
 * Mesmo contorno dos campos do portal: borda de 1px sempre, sem contorno nativo
 * por cima dela, e o foco trocando apenas a cor da borda por um cinza mais
 * escuro. É o padrão já usado nos campos da tela Usuários.
 */
const FIELD_BORDER_CLASS = 'border-[#dfe3ec] focus:outline-none focus:border-[#667085]'

export function Preferences() {
    const {user} = useAuth()
    const {homeDepartmentIdFor, setHomeDepartmentId} = usePreferences()
    const fieldId = useId()
    const hintId = useId()

    if (!user) return null

    const showHomeDepartment = canChooseHomeDepartment(user)

    // Nomes oficiais e ordem oficial vêm do catálogo, e não de uma lista própria.
    const options = accessibleHomeDepartmentIds(user).flatMap((departmentId) => {
        const area = biAreas.find((item) => item.id === departmentId)

        return area ? [area] : []
    })

    // Valor exibido é o efetivo, e não o gravado: sem escolha salva, o seletor já
    // mostra o departamento em que o portal realmente abre.
    const selectedDepartmentId = resolveHomeDepartmentId(user, homeDepartmentIdFor(user.id))

    return (
        <div className="grid gap-5">
            <div>
                <h2 className="text-base font-bold text-[#1a2331]">Preferências</h2>
                <p className="mt-1 text-[13px] text-[#667085]">
                    Personalize o comportamento do portal neste navegador.
                </p>
            </div>

            {showHomeDepartment && selectedDepartmentId ? (
                <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
                    <h3 className="text-[15px] font-semibold text-[#1a2331]">Página inicial</h3>
                    <p className="mt-1.5 text-[13px] text-[#667085]" id={hintId}>
                        Escolha qual departamento será aberto ao entrar no portal.
                    </p>
                    <label
                        className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#344054]"
                        htmlFor={fieldId}
                    >
                        Departamento inicial
                    </label>
                    <select
                        aria-describedby={hintId}
                        className={`w-full cursor-pointer rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] sm:max-w-sm`}
                        id={fieldId}
                        onChange={(event) => setHomeDepartmentId(user.id, event.target.value)}
                        value={selectedDepartmentId}
                    >
                        {options.map((area) => (
                            <option key={area.id} value={area.id}>
                                {area.label}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}

            <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
        <span
            className="inline-flex items-center rounded-full bg-[#f1f3f7] px-2.5 py-1 text-[11px] font-semibold text-[#667085]">
          Em desenvolvimento
        </span>
                <h3 className="mt-3 text-[15px] font-semibold text-[#1a2331]">Preferências do portal</h3>
                <p className="mt-1.5 text-[13px] text-[#667085]">
                    Novas opções de personalização serão disponibilizadas nesta área em uma próxima etapa.
                </p>
            </div>
        </div>
    )
}
