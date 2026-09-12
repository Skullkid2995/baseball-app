import PublicSampleSession from '@/components/PublicSampleSession'

export default async function WritePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <PublicSampleSession code={code} />
}
