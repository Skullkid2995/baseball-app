import Layout from '@/components/Layout'
import ManagerFaceoff from '@/components/ManagerFaceoff'

export default async function FaceoffPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  return <Layout><ManagerFaceoff gameId={gameId} /></Layout>
}
