export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-navy">Klaz</h1>
          <p className="mt-2 text-sm text-slate-500">
            AI-powered classroom intelligence
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
