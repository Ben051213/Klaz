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
    <div className="flex flex-col items-start gap-3 rounded-xl border border-klaz-line bg-klaz-panel p-4 sm:flex-row sm:items-center sm:gap-6">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="Join code QR"
          className="h-28 w-28 rounded-md border border-klaz-line2 bg-white"
        />
      ) : (
        <div className="h-28 w-28 animate-pulse rounded-md bg-klaz-line2" />
      )}
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
          Join code
        </p>
        <p className="mt-1 font-mono text-[28px] font-semibold tracking-[0.08em] text-klaz-ink">
          {code}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 rounded-md border-klaz-line bg-klaz-panel2 text-[12.5px] font-medium text-klaz-ink2 hover:bg-klaz-line2"
          onClick={copy}
          type="button"
        >
          Copy code
        </Button>
      </div>
    </div>
  )
}
