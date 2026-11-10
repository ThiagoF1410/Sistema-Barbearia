import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

const mocks = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: mocks.login }) }))
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, useNavigate: () => mocks.navigate }
})

function montar() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('Tela de login', () => {
  beforeEach(() => {
    mocks.login.mockReset()
    mocks.navigate.mockReset()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/login')
  })

  it('exibe os campos e caminhos auxiliares', () => {
    montar()
    expect(screen.getByRole('heading', { name: /bem-vindo de volta/i })).toBeVisible()
    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText(/^senha$/i)).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('link', { name: /esqueci minha senha/i })).toHaveAttribute('href', '/esqueci-senha')
    expect(screen.getByRole('link', { name: /criar conta/i })).toHaveAttribute('href', '/cadastro')
  })

  it('impede envio com campos obrigatórios vazios', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(await screen.findByText('Informe seu e-mail.')).toBeVisible()
    expect(screen.getByText('Informe sua senha.')).toBeVisible()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('rejeita e-mail inválido', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText(/e-mail/i), 'email-invalido')
    await user.type(screen.getByLabelText(/^senha$/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(await screen.findByText(/e-mail inv/i)).toBeVisible()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it.each([
    ['cliente', '/dashboard'],
    ['profissional', '/profissional'],
    ['admin', '/admin'],
  ])('autentica e direciona o perfil %s para %s', async (role, destino) => {
    const user = userEvent.setup()
    mocks.login.mockResolvedValue({ role })
    montar()
    await user.type(screen.getByLabelText(/e-mail/i), 'cliente@example.com')
    await user.type(screen.getByLabelText(/^senha$/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(mocks.login).toHaveBeenCalledWith({ email: 'cliente@example.com', password: 'Senha@123' })
    expect(mocks.navigate).toHaveBeenCalledWith(destino)
  })

  it('apresenta erro devolvido pela API', async () => {
    const user = userEvent.setup()
    mocks.login.mockRejectedValue({ response: { data: { message: 'Credenciais inválidas.' } } })
    montar()
    await user.type(screen.getByLabelText(/e-mail/i), 'cliente@example.com')
    await user.type(screen.getByLabelText(/^senha$/i), 'SenhaErrada')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(await screen.findByText('Credenciais inválidas.')).toBeVisible()
  })

  it('mostra e oculta a senha preservando seu valor', async () => {
    const user = userEvent.setup()
    montar()
    const senha = screen.getByLabelText(/^senha$/i)
    await user.type(senha, 'Senha@123')
    await user.click(screen.getByRole('button', { name: /mostrar senha/i }))
    expect(senha).toHaveAttribute('type', 'text')
    expect(senha).toHaveValue('Senha@123')
    await user.click(screen.getByRole('button', { name: /ocultar senha/i }))
    expect(senha).toHaveAttribute('type', 'password')
  })
})
