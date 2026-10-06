import Shell from "@/components/shell"
import Live from "./live"
export const dynamic = "force-dynamic"
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Shell active="/jobs"><h1>مهمة #{id}</h1><Live id={Number(id)} /></Shell>
}
