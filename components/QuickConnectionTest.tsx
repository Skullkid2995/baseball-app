'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function QuickConnectionTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const testConnection = async () => {
    setStatus('testing')
    setMessage('Testing connection...')
    
    try {
      // Probe real tables in the exposed schema instead of information_schema
      const tryTables = ['teams', 'players', 'games']
      let lastError: string | null = null
      for (const table of tryTables) {
        const { error } = await supabase
          .from(table)
          .select('*', { head: true, count: 'exact' })
          .limit(1)
        if (!error) {
          setStatus('success')
          setMessage(`Connection successful! Reached table: ${table}`)
          return
        }
        lastError = error.message
      }

      setStatus('error')
      setMessage(`Could not query test tables. Last error: ${lastError}`)
    } catch (err) {
      setStatus('error')
      setMessage(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Quick Connection Test</h3>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">Supabase Client Test:</h4>
        <p className="text-sm text-gray-600 mb-4">
          This test uses the Supabase client directly to check if the connection works.
        </p>
        
        <button
          onClick={testConnection}
          disabled={status === 'testing'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">What this test does:</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Uses the Supabase client (not direct HTTP)</li>
          <li>• Tests authentication with your API key</li>
          <li>• Queries actual tables in your schema (teams, players, games)</li>
          <li>• Shows detailed error messages if it fails</li>
        </ul>
      </div>
    </div>
  )
}
