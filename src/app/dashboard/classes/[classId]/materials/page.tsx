import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ClassSettingsClient } from "@/components/ClassSettingsClient"
import { MaterialsManager } from "@/components/MaterialsManager"
import { createClient } from "@/lib/supabase/server"

// Teacher view for adding / editing class materials. Each row is plain text
// (syllabus snippet, lesson plan, worked example) — the tutor's system prompt
// concatenates them so answers echo the teacher's language. Deliberately
// text-only for now; PDF-to-text can layer on later without a schema change.
export default async function ClassMaterialsPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: klass } = await supabase
    .from("classes")
    .select("id, teacher_id, name, subject, tutor_tone, flavor")
    .eq("id", classId)
    .single()
  if (!klass) notFound()
  if (klass.teacher_id !== user.id) redirect("/dashboard")

  const { data: materialsRaw } = await supabase
    .from("class_materials")
    .select("id, title, content, kind, updated_at, created_at")
    .eq("class_id", classId)
    .order("updated_at", { ascending: false })

  type Material = {
    id: string
    title: string
    content: string
    kind: "notes" | "syllabus" | "lesson"
    updated_at: string
    created_at: string
  }
  const materials = (materialsRaw as Material[] | null) ?? []

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${classId}`}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition hover:text-klaz-ink2"
      >
        ← {klass.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
            Class materials<span className="text-klaz-accent">.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-klaz-muted">
            Paste syllabus sections, lesson plans, or worked examples. The
            tutor reads this before answering — so the more your class voice
            shows up here, the more the answers sound like{" "}
            <span className="font-medium text-klaz-ink">you</span>.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <MaterialsManager classId={classId} initialMaterials={materials} />
      </div>

      <div className="mt-8">
        <ClassSettingsClient
          classId={classId}
          initialTone={
            (klass as { tutor_tone?: string | null }).tutor_tone ?? ""
          }
          initialFlavor={
            (klass as { flavor?: string | null }).flavor ?? null
          }
        />
      </div>
    </div>
  )
}
