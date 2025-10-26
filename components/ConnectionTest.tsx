'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EnvDebug from './EnvDebug'

export default function ConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [config, setConfig] = useState<{url: string, key: string}>({url: '', key: ''})

  useEffect(() => {
    async function testConnection() {
      try {
        setConnectionStatus('testing')
        
        // Test basic connection
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .limit(1)

        if (error) {
          setConnectionStatus('error')
          setErrorMessage(error.message)
        } else {
          setConnectionStatus('success')
        }
      } catch (err) {
        setConnectionStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    // Get current config for display
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uzbupbtrmbmmmkztmrtl.supabase.co'
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
      `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 
      'sb_publishable_9SCztcTwOswuhb6hKmMY_A_XIzTPLKs'
    
    setConfig({ url, key })
    testConnection()
  }, [])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Connection Test</h3>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">Configuration:</h4>
        <div className="space-y-1 text-sm">
          <p><span className="font-mono text-blue-600">URL:</span> {config.url}</p>
          <p><span className="font-mono text-blue-600">Key:</span> {config.key}</p>
        </div>
      </div>

      <EnvDebug />

      {connectionStatus === 'testing' && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Testing connection...</span>
        </div>
      )}

      {connectionStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
            <p className="text-green-800 font-medium">✅ Connection successful!</p>
          </div>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
            <p className="text-red-800 font-medium">❌ Connection failed</p>
          </div>
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
