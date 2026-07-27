export function Preferences() {
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-base font-bold text-[#1a2331]">Preferências</h2>
        <p className="mt-1 text-[13px] text-[#667085]">
          Personalize o comportamento do portal neste navegador.
        </p>
      </div>
      <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
        <span className="inline-flex items-center rounded-full bg-[#f1f3f7] px-2.5 py-1 text-[11px] font-semibold text-[#667085]">
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
