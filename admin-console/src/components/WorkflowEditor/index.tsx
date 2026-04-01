import { useMemo } from 'react'
import { useAdapters } from '../../hooks/useAdapters'
import { collectKnownStateKeys } from './collectKeys'
import { parseWorkflow, serializeWorkflow } from './yamlCodec'
import { WorkflowMeta } from './WorkflowMeta'
import { StageList } from './StageList'
import type { WorkflowDoc } from './types'

export interface WorkflowEditorProps {
  /** Current workflow YAML (draft) */
  yaml: string
  /** Called whenever the structured editor produces new YAML */
  onYamlChange: (yaml: string) => void
}

export function WorkflowEditor({ yaml, onYamlChange }: WorkflowEditorProps) {
  const { data: adapters = [] } = useAdapters()
  const adapterNames = useMemo(() => adapters.map((a) => a.adapter_name).sort(), [adapters])

  const { doc, parseError } = useMemo((): { doc: WorkflowDoc | null; parseError: string | null } => {
    try {
      return { doc: parseWorkflow(yaml), parseError: null }
    } catch (e) {
      return {
        doc: null,
        parseError: e instanceof Error ? e.message : String(e),
      }
    }
  }, [yaml])

  const knownStateKeys = useMemo(() => (doc ? collectKnownStateKeys(doc) : []), [doc])

  const allowedAdapters = useMemo(
    () => (doc ? adapters.filter((a) => doc.adapters.includes(a.adapter_name)) : []),
    [adapters, doc]
  )

  const onDocChange = (next: WorkflowDoc) => {
    onYamlChange(serializeWorkflow(next))
  }

  if (parseError || !doc) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
        <p className="font-semibold">Could not parse workflow YAML</p>
        <p className="mt-1 font-mono text-xs">{parseError}</p>
        <p className="mt-2 text-xs">Switch to &quot;Raw YAML&quot; to fix syntax, then try structured mode again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <WorkflowMeta doc={doc} onChange={onDocChange} adapterNames={adapterNames} />
      <StageList
        stages={doc.stages}
        onChange={(stages) => onDocChange({ ...doc, stages })}
        adapters={allowedAdapters}
        knownStateKeys={knownStateKeys}
      />
    </div>
  )
}

export { parseWorkflow, serializeWorkflow } from './yamlCodec'
export type { WorkflowDoc } from './types'
