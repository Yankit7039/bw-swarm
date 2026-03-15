import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Clock } from 'lucide-react'
import { useTemplates } from '../hooks/useTemplates'

export const Templates = () => {
  const navigate = useNavigate()
  const { data, isLoading } = useTemplates()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Templates</h2>
          <p className="text-gray-500">Manage workflow templates</p>
        </div>
        <button
          onClick={() => navigate('/templates/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No templates yet</p>
          <button
            onClick={() => navigate('/templates/new')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {data?.data.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  v{template.version}
                </span>
              </div>
              <h3 className="font-semibold mb-2">{template.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                {new Date(template.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
