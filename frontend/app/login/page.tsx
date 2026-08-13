'use client'

import { useEffect, useState, type FormEvent } from 'react'
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
  const { login, usuario, loading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (!loading && usuario) {
      router.replace(getRolDefaultRoute(usuario.roles))
    }
  }, [loading, router, usuario])

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
      router.replace(getRolDefaultRoute(usuario.roles))
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'No fue posible iniciar sesión'
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main className="flex min-h-dvh overflow-y-auto bg-bg-base md:h-dvh md:overflow-hidden">
      <section className="relative z-10 flex min-h-dvh w-full shrink-0 items-center bg-bg-base px-6 py-10 sm:px-12 md:w-[40%] md:py-8 lg:px-[7.5vw]">
        <div className="mx-auto w-full max-w-[300px] md:mx-0">
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
              label="Contraseña"
              type="password"
              icon={<Lock size={15} />}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              autoComplete="current-password"
              className="border-accent/30 bg-bg-base"
            />
            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={submitting}
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
          <p className="mt-12 text-[10px] text-text-disabled">
            © {currentYear} Comanda Systems
          </p>
        </div>
      </section>
      <section
        aria-hidden="true"
        className="pointer-events-none relative hidden min-w-0 flex-1 overflow-hidden md:block"
      >
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
