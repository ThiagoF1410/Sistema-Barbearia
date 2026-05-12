import api from './api'

const authService = {
  /**
   * Registra um novo cliente.
   * @param {{ full_name, email, phone, password }} data
   * @returns {{ token, user }}
   */
  async register(data) {
    const response = await api.post('/auth/register', {
      full_name: data.full_name,
      email:     data.email,
      phone:     data.phone.replace(/\D/g, ''), // envia apenas dígitos
      password:  data.password,
    })
    return response.data
  },

  /**
   * Autentica um usuário existente.
   * @param {{ email, password }} data
   * @returns {{ token, user }}
   */
  async login(data) {
    const response = await api.post('/auth/login', {
      email:    data.email,
      password: data.password,
    })
    return response.data
  },

  /**
   * Recupera o perfil do usuário autenticado.
   * Requer token no header (configurado automaticamente pelo interceptor em api.js).
   */
  async getMe() {
    const response = await api.get('/users/me')
    return response.data
  },
}

export default authService