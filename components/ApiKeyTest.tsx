'use client'

import { useEffect, useState } from 'react'

export default function ApiKeyTest() {
  const [results, setResults] = useState<Array<{key: string, status: string, error?: string}>>([])
  const [testing, setTesting] = useState(false)

  const apiKeys = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y',
    // Add other possible key formats if needed
  ]

  useEffect(() => {
    async function testApiKeys() {
      setTesting(true)
      const results = []
      
      for (const key of apiKeys) {
        try {
          // Add timeout to prevent hanging
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
          
          const response = await fetch('https://uzbupbtrmbmmmkztmrtl.supabase.co/rest/v1/', {
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          results.push({
            key: key.substring(0, 20) + '...',
            status: response.ok ? 'SUCCESS' : `HTTP ${response.status}`,
            error: response.ok ? undefined : await response.text()
          })
        } catch (err) {
          results.push({
            key: key.substring(0, 20) + '...',
            status: 'ERROR',
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
      
      setResults(results)
      setTesting(false)
    }

    testApiKeys()
  }, [])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">API Key Test</h3>
      
      {testing && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Testing API keys...</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, index) => (
            <div key={index} className={`p-3 rounded-lg border ${
              result.status === 'SUCCESS' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{result.key}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  result.status === 'SUCCESS' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.status}
                </span>
              </div>
              {result.error && (
                <p className="text-xs text-red-600 mt-1">{result.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• If all keys fail, check your Supabase dashboard for the correct anon key</li>
          <li>• The anon key should start with &apos;eyJ&apos; (JWT format)</li>
          <li>• Make sure you&apos;re using the &apos;anon public&apos; key, not the service role key</li>
        </ul>
      </div>
    </div>
  )
}
