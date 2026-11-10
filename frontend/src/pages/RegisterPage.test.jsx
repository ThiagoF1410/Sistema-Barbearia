import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import { limparRascunhoCadastro } from '../utils/registerDraft'

const mocks = vi.hoisted(() => ({ register: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ register: mocks.register }) }))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/cadastro']}>
      <Routes>
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function preencherCadastro(user) {
  await user.type(screen.getByLabelText(/nome completo/i), 'Thiago Francisco')
  await user.type(screen.getByLabelText(/e-mail/i), 'thiago@example.com')
  await user.type(screen.getByLabelText(/telefone/i), '18999999999')
  await user.type(screen.getByLabelText(/^senha$/i), 'SenhaForte@123')
  await user.type(screen.getByLabelText(/^confirmar$/i), 'SenhaForte@123')
  await user.click(screen.getByRole('checkbox'))
}

function esperarCadastroPreenchido() {
  expect(screen.getByLabelText(/nome completo/i)).toHaveValue('Thiago Francisco')
  expect(screen.getByLabelText(/e-mail/i)).toHaveValue('thiago@example.com')
  expect(screen.getByLabelText(/telefone/i)).toHaveValue('(18) 99999-9999')
  expect(screen.getByLabelText(/^senha$/i)).toHaveValue('SenhaForte@123')
  expect(screen.getByLabelText(/^confirmar$/i)).toHaveValue('SenhaForte@123')
  expect(screen.getByRole('checkbox')).toBeChecked()
}

describe('Tela de cadastro', () => {
  beforeEach(() => {
    mocks.register.mockReset()
    limparRascunhoCadastro()
  })

  it.each([
    ['Termos de Uso', /termos de uso/i],
    ['Política de Privacidade', /política de privacidade/i],
  ])('preserva os dados ao consultar %s e voltar', async (_, linkName) => {
    const user = userEvent.setup()
    montar()
    await preencherCadastro(user)

    await user.click(screen.getByRole('link', { name: linkName }))
    await user.click(screen.getByRole('link', { name: /voltar ao cadastro/i }))

    esperarCadastroPreenchido()
  })
})
