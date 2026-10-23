// ---------------------------------------------------------------------------
// Tela de login - interações (versão HTML/Tailwind/CSS/JS).
// Espelha o comportamento do componente React Login.tsx:
//  - alternar visibilidade da senha (ícone Eye / EyeOff)
//  - envio do formulário (placeholder, autenticação a implementar)
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggle-password')
  const passwordInput = document.getElementById('password')
  const eyeIcon = toggleButton.querySelector('.icon-eye')
  const eyeOffIcon = toggleButton.querySelector('.icon-eye-off')

  let showPassword = false

  toggleButton.addEventListener('click', () => {
    showPassword = !showPassword

    passwordInput.type = showPassword ? 'text' : 'password'

    eyeIcon.classList.toggle('hidden', showPassword)
    eyeOffIcon.classList.toggle('hidden', !showPassword)

    const label = showPassword ? 'Ocultar senha' : 'Mostrar senha'
    toggleButton.setAttribute('aria-label', label)
    toggleButton.setAttribute('title', label)
    toggleButton.setAttribute('aria-pressed', String(showPassword))
  })

  const form = document.getElementById('login-form')

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const email = form.email.value.trim()
    const password = form.password.value

    // Demonstração: sem backend. Substituir pela chamada de autenticação real.
    console.log('Login solicitado:', { email, hasPassword: password.length > 0 })
    window.alert('Login de demonstração. Autenticação a implementar.')
  })
})
