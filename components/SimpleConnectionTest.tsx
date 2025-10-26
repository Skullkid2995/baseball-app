'use client'

import { useEffect, useState } from 'react'

export default function SimpleConnectionTest() {
  const [status, setStatus] = useState<'testing' | 'success' | 'error'>('testing')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function testConnection() {
      try {
        setStatus('testing')
        
        // Test with a simple fetch to Supabase REST API
        const url = 'https://uzbupbtrmbmmmkztmrtl.supabase.co'
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y'
        
        const response = await fetch(`${url}/rest/v1/`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          setStatus('success')
          setMessage('Connection successful!')
        } else {
          setStatus('error')
          setMessage(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    testConnection()
  }, [])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Simple Connection Test</h3>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">Environment Variables:</h4>
        <div className="space-y-1 text-sm font-mono">
          <p><span className="text-blue-600">URL:</span> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uzbupbtrmbmmmkztmrtl.supabase.co'}</p>
          <p><span className="text-blue-600">KEY:</span> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y'}</p>
        </div>
      </div>

      {status === 'testing' && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Testing connection...</span>
        </div>
      )}

      {status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
            <p className="text-green-800 font-medium">✅ {message}</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
            <p className="text-red-800 font-medium">❌ Connection failed</p>
          </div>
          <p className="text-red-700 text-sm">{message}</p>
        </div>
      )}
    </div>
  )
}
