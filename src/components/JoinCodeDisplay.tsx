"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function JoinCodeDisplay({ code }: { code: string; classId?: string }) {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    const url = `${
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")
    }/join?code=${code}`
    QRCode.toDataURL(url, { width: 180, margin: 1 })
      .then((dataUrl) => setQr(dataUrl))
      .catch(() => setQr(null))
  }, [code])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Join code copied")
    } catch {
      toast.error("Could not copy")
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-6">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="Join code QR"
          className="h-32 w-32 rounded-md border border-slate-100 bg-white"
        />
      ) : (
        <div className="h-32 w-32 animate-pulse rounded-md bg-slate-100" />
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Join code
        </p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-brand-navy">
          {code}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={copy}
          type="button"
        >
          Copy code
        </Button>
      </div>
    </div>
  )
}
