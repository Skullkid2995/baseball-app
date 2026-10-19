import { redirect } from 'next/navigation'

export default async function FaceoffPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  redirect(`/live/${gameId}`)
}
