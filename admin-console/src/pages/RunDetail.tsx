import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'

export const RunDetail = () => {
  const { runId } = useParams<{ runId: string }>()

  const {
    data: run,
  } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId || ''),
    enabled: !!runId,
    refetchInterval: (data) =>
      data && (data.status === 'completed' || data.status === 'failed') ? false : 2000,
  })

  const {
    data: events,
  } = useQuery({
    queryKey: ['run-events', runId],
    queryFn: () => runsApi.events(runId || ''),
    enabled: !!runId,
    refetchInterval: 1500,
  })

  if (!runId) {
    return <div className="text-sm text-gray-500">No run selected.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Run Detail</h1>
        <p className="mt-1 text-sm text-gray-500 font-mono break-all">{runId}</p>
      </div>

      {run && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-gray-500">Template</div>
            <div className="font-mono text-xs">{run.template_id}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-gray-500">Status</div>
            <div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  run.status === 'completed'
                    ? 'bg-green-50 text-green-700'
                    : run.status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {run.status}
              </span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1 text-xs text-gray-600">
            <div>
              <span className="font-medium">Created:</span>{' '}
              {run.created_at ? new Date(run.created_at).toLocaleString() : '-'}
            </div>
            <div>
              <span className="font-medium">Updated:</span>{' '}
              {run.updated_at ? new Date(run.updated_at).toLocaleString() : '-'}
            </div>
            <div>
              <span className="font-medium">Completed:</span>{' '}
              {run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}
            </div>
          </div>
        </div>
      )}

      {run?.error_message && (
        <div className="bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg p-4">
          <div className="font-medium mb-1">Error</div>
          <pre className="whitespace-pre-wrap break-words">{run.error_message}</pre>
        </div>
      )}

      {run?.result && (
        <div className="bg-gray-50 border border-gray-200 text-xs rounded-lg p-4">
          <div className="font-medium mb-1 text-gray-700">Result</div>
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(run.result, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Events</h2>
          <span className="text-xs text-gray-400">{events?.length ?? 0} events</span>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          <ul className="divide-y divide-gray-100 text-xs">
            {events?.map((e, idx) => (
              <li key={idx} className="px-4 py-3 flex gap-3">
                <div className="w-32 text-gray-500 font-mono">
                  {e.created_at ? new Date(e.created_at).toLocaleTimeString() : '-'}
                </div>
                <div className="w-40">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {e.event_type}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-gray-900 mb-1">{e.event}</div>
                  {e.payload && (
                    <pre className="text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap break-words">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
            {!events?.length && (
              <li className="px-4 py-6 text-center text-gray-500">
                No events yet. They will appear here as the workflow progresses.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

