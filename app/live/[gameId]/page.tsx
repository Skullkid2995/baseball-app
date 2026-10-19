import Layout from '@/components/Layout'
import LiveGameView from '@/components/LiveGameView'

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  return <Layout><LiveGameView gameId={gameId} /></Layout>
}
