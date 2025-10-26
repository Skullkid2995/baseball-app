'use client'

export default function EnvDebug() {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-700 mb-2">Environment Debug:</h4>
      <div className="space-y-1 text-sm font-mono">
        <p><span className="text-blue-600">NEXT_PUBLIC_SUPABASE_URL:</span> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined'}</p>
        <p><span className="text-blue-600">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined'}</p>
        <p><span className="text-blue-600">NODE_ENV:</span> {process.env.NODE_ENV}</p>
      </div>
    </div>
  )
}
