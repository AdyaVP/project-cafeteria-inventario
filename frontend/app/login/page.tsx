'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, CreditCard, Lock, Store } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getRolDefaultRoute } from '@/lib/constants'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'

const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Campo requerido')
    .email('Ingresa un correo válido')
    .toLowerCase(),
  password: z.string().min(1, 'Campo requerido'),
})
interface LoginErrors {
  email?: string
  password?: string
}

export default function LoginPage(): React.JSX.Element {
  const currentYear = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const result = LoginSchema.safeParse({ email, password })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setErrors({ email: fields.email?.[0], password: fields.password?.[0] })
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const usuario = await login(result.data.email, result.data.password)
      router.push(getRolDefaultRoute(usuario.roles))
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'No fue posible iniciar sesión'
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main className="flex h-screen overflow-hidden bg-bg-base">
      <section className="relative z-10 flex w-full shrink-0 items-center bg-bg-base px-8 sm:px-12 md:w-[40%] lg:px-[7.5vw]">
        <div className="w-full max-w-[300px]">
          <div className="mb-9">
            <div className="flex items-center gap-2">
              <Store size={22} className="text-accent" />
              <span className="text-2xl font-bold text-text-primary">
                Comanda
              </span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-text-primary">
              Punto de venta
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <Input
              name="email"
              label="Correo electrónico"
              icon={<CreditCard size={15} />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              autoComplete="username"
              className="border-accent/30 bg-bg-base"
            />
            <Input
              name="password"
              label="Password"
              type="password"
              icon={<Lock size={15} />}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              autoComplete="current-password"
              className="border-accent/30 bg-bg-base"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-text-primary"></label>
              <button
                type="button"
                className="min-h-[44px] text-xs text-text-primary hover:text-accent"
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              icon={
                !submitting ? (
                  <ArrowRight size={16} className="order-2" />
                ) : undefined
              }
              className="mt-3 text-bg-base uppercase tracking-[0.18em]"
            >
              Acceder
            </Button>
          </form>
        </div>
        <p className="absolute bottom-6 left-8 text-[10px] text-text-disabled sm:left-12 lg:left-[7.5vw]">
          © {currentYear} Comanda Systems
        </p>
      </section>
      <section className="relative hidden min-w-0 flex-1 overflow-hidden md:block">
        <Image
          src="/images/login-image.png"
          alt="Interior de la cafetería Comanda"
          fill
          priority
          sizes="60vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/50 to-transparent" />
      </section>
    </main>
  )
}
