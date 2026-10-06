import Shell from "@/components/shell"
import { presets, templates } from "@/lib/stores-api"
import Wizard from "./wizard"

export const dynamic = "force-dynamic"
export default async function NewStore() {
  const p = presets()
  return <Shell active="/stores/new"><h1>متجر جديد</h1><Wizard templates={templates()} palettes={p.palettes} fonts={p.fonts} platformDomain={process.env.PLATFORM_DOMAIN || "naqla.local"} /></Shell>
}
