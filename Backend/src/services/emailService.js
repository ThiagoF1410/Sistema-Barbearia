const nodemailer = require('nodemailer')
const smtpPort = Number(process.env.SMTP_PORT) || 587

const transporter = nodemailer.createTransport({
  host:     process.env.SMTP_HOST || 'smtp.gmail.com',
  port:     smtpPort,
  secure:   smtpPort === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

async function sendPasswordResetEmail(to, token) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER e EMAIL_PASS precisam estar configurados.')
  }
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/resetar-senha?token=${token}`

  await transporter.sendMail({
    from:    `"O Rei da Navalha" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Redefinição de senha — O Rei da Navalha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1c1b1b; margin: 0 0 16px;">Redefinição de senha</h2>
        <p style="color: #555; line-height: 1.6;">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background: #1c1b1b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Redefinir minha senha</a>
        </p>
        <p style="color: #999; font-size: 12px; line-height: 1.5;">Este link expira em <strong>1 hora</strong>. Se você não solicitou esta alteração, ignore este e-mail.</p>
      </div>
    `,
  })
}

module.exports = { sendPasswordResetEmail }
