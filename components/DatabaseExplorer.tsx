'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TableInfo {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
}

export default function DatabaseExplorer() {
  const [tables, setTables] = useState<string[]>([])
  const [tableDetails, setTableDetails] = useState<Record<string, TableInfo[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDatabaseInfo() {
      try {
        setLoading(true)
        
        // Get all tables
        const { data: tablesData, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .order('table_name')

        if (tablesError) {
          setError(tablesError.message)
          return
        }

        const tableNames = tablesData?.map(item => item.table_name) || []
        setTables(tableNames)

        // Get column details for each table
        const tableDetailsMap: Record<string, TableInfo[]> = {}
        
        for (const tableName of tableNames) {
          const { data: columnsData, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_schema', 'public')
            .eq('table_name', tableName)
            .order('ordinal_position')

          if (!columnsError && columnsData) {
            tableDetailsMap[tableName] = columnsData.map(col => ({
              ...col,
              table_name: tableName
            }))
          }
        }

        setTableDetails(tableDetailsMap)
      } catch (err) {
        setError('Failed to fetch database information')
      } finally {
        setLoading(false)
      }
    }

    fetchDatabaseInfo()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Exploring your database...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Your Database Tables ({tables.length})
        </h3>
        
        {tables.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No tables found in your database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <div 
                key={table} 
                className={`bg-white border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedTable === table 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedTable(selectedTable === table ? null : table)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{table}</h4>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {tableDetails[table]?.length || 0} columns
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Click to view structure
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTable && tableDetails[selectedTable] && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Table Structure: {selectedTable}
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nullable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableDetails[selectedTable].map((column, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">{column.column_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{column.data_type}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      <span className={`px-2 py-1 rounded text-xs ${
                        column.is_nullable === 'YES' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {column.is_nullable === 'YES' ? 'Nullable' : 'Required'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
