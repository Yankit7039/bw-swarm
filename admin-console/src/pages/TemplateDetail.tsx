import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  Rocket,
  CheckCircle,
  Save,
  AlertCircle,
  // ChevronRight,
  // Activity,
  // Scan,
  // Sparkles,
  // History,
  // Shield,
  // Database,
  // Network,
  // Wrench,
  RefreshCw,
  // Search,
  // MessageSquare,
  Edit3,
  Webhook,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useTemplate, useUpdateTemplateWorkflowYaml } from '../hooks/useTemplates'
import { validateTemplateYaml } from '../utils/workflowYamlValidation'
import { highlightYAMLLine } from '../utils/yamlHighlight'
import { WorkflowEditor, parseWorkflow } from '../components/WorkflowEditor'

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      const parts = d.map((x: { msg?: string }) => x.msg).filter(Boolean)
      if (parts.length) return parts.join(', ')
    }
  }
  if (err instanceof Error) return err.message
  return 'Save failed'
}

// Get YAML content from template - use workflow_yaml if available
function getYamlContent(workflowYaml: string | null | undefined, templateId: string, templateName: string): string {
  if (workflowYaml && workflowYaml.trim().length > 0) {
    return workflowYaml
  }

  // Fallback when workflow_yaml is not available
  return `# Template Configuration
# Template ID: ${templateId}
# Name: ${templateName}
# Note: No workflow YAML available

version: '1.0'
template_id: "${templateId}"
name: "${templateName}"`
}

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: template, isPending, isError } = useTemplate(id ?? '')
  const updateYaml = useUpdateTemplateWorkflowYaml()
  const [isEditing, setIsEditing] = useState(false)
  const [draftYaml, setDraftYaml] = useState('')
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [isValidating, setIsValidating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)
  const [editView, setEditView] = useState<'structured' | 'raw'>('structured')
  const [yamlPreviewOpen, setYamlPreviewOpen] = useState(true)

  useEffect(() => {
    setIsEditing(false)
    setValidationStatus('idle')
    setValidationMessage(null)
    setEditView('structured')
    setYamlPreviewOpen(true)
  }, [id])

  const yamlContent = useMemo(
    () =>
      getYamlContent(
        template?.workflow_yaml,
        id || '',
        template?.name || 'Unnamed Template'
      ),
    [template?.workflow_yaml, id, template?.name]
  )
  const yamlLines = useMemo(() => yamlContent.split('\n'), [yamlContent])
  const previewLines = useMemo(() => draftYaml.split('\n'), [draftYaml])
  const editorSource = isEditing ? draftYaml : yamlContent
  const lineCount = editorSource.split('\n').length
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  const handleStartEdit = () => {
    setDraftYaml(yamlContent)
    updateYaml.reset()
    setValidationStatus('idle')
    setValidationMessage(null)
    setIsEditing(true)
    try {
      parseWorkflow(yamlContent)
      setEditView('structured')
    } catch {
      setEditView('raw')
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    updateYaml.reset()
    setValidationStatus('idle')
    setValidationMessage(null)
    setEditView('structured')
  }

  const trySetStructuredView = () => {
    try {
      parseWorkflow(draftYaml)
      setEditView('structured')
    } catch {
      // WorkflowEditor will show parse error when view switches
      setEditView('structured')
    }
  }

  const handleSaveYaml = () => {
    if (!template) return
    const check = validateTemplateYaml(draftYaml)
    if (!check.ok) {
      setValidationStatus('invalid')
      setValidationMessage(check.message)
      return
    }
    setValidationStatus('valid')
    setValidationMessage(null)
    updateYaml.mutate(
      { id: template.id, workflow_yaml: draftYaml },
      {
        onSuccess: () => {
          setIsEditing(false)
          setValidationStatus('idle')
          setValidationMessage(null)
        },
      }
    )
  }

  const syncLineScroll = () => {
    const ta = textareaRef.current
    const ln = lineNumbersRef.current
    if (ta && ln) ln.scrollTop = ta.scrollTop
  }

  // Webhook configuration
  const webhookUrl = useMemo(() => {
    if (!template) return ''
    const baseUrl = window.location.origin.replace(':5173', ':30081').replace(':3000', ':8000')
    return `${baseUrl}/webhooks/templates/${template.id}`
  }, [template])

  const samplePayload = useMemo(() => {
    if (!template) return {}
    const templateId = template.id.toLowerCase()
    if (templateId.includes('esim')) {
      return {
        order_id: 'ESIM-12345'
        // customer_email: 'customer@example.com',
        // iccid: '8912345678901234567',
        // activation_code: 'ABCD1234'
      }
    } else if (templateId.includes('port')) {
      return {
        order_id: 'PORT-67890'
        // customer_email: 'customer@example.com',
        // porting_number: '+1234567890',
        // donor_carrier: 'Previous Carrier'
      }
    } else if (templateId.includes('stuck')) {
      return {
        order_id: 'ORD-54321'
        // customer_email: 'customer@example.com',
        // issue_type: 'billing_hold',
        // priority: 'high'
      }
    }
    return {
      order_id: 'ORD-XXXXX'
      // customer_email: 'customer@example.com',
      // priority: 'medium'
    }
  }, [template])

  // Batch payload - multiple orders
  const batchPayload = useMemo(() => {
    return {
      orders: [
        { order_id: 'ORDER-12345' },
        { order_id: 'ORDER-12346' },
        { order_id: 'ORDER-12347' }
      ]
    }
  }, [])

  const samplePayloadJson = useMemo(() => JSON.stringify(samplePayload, null, 2), [samplePayload])
  const batchPayloadJson = useMemo(() => JSON.stringify(batchPayload, null, 2), [batchPayload])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(samplePayloadJson)
      setCopiedPayload(true)
      setTimeout(() => setCopiedPayload(false), 2000)
    } catch {
      // ignore
    }
  }

  const [copiedBatch, setCopiedBatch] = useState(false)
  const handleCopyBatch = async () => {
    try {
      await navigator.clipboard.writeText(batchPayloadJson)
      setCopiedBatch(true)
      setTimeout(() => setCopiedBatch(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleValidate = () => {
    const source = isEditing ? draftYaml : yamlContent
    setIsValidating(true)
    setValidationMessage(null)
    window.setTimeout(() => {
      const result = validateTemplateYaml(source)
      setIsValidating(false)
      if (result.ok) {
        setValidationStatus('valid')
        setValidationMessage(null)
      } else {
        setValidationStatus('invalid')
        setValidationMessage(result.message)
      }
    }, 120)
  }

  const handleDeploy = () => {
    setIsDeploying(true)
    setTimeout(() => {
      setIsDeploying(false)
      navigate('/test-runs')
    }, 2000)
  }

  if (!id) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Template not found</p>
            <Link to="/templates" className="mt-4 text-primary hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Templates
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (isPending) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" aria-hidden />
          <span className="sr-only">Loading template</span>
        </div>
      </Layout>
    )
  }

  if (isError || !template) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-500">Template not found</p>
            <Link to="/templates" className="mt-4 text-primary hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Templates
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <style>{`
        .yaml-editor::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .yaml-editor::-webkit-scrollbar-track {
          background: transparent;
        }
        .yaml-editor::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 3px;
        }
        .yaml-editor::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.4);
        }
      `}</style>

      <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
        {/* Sub Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* <Link
              to="/templates"
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link> */}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{template.name}</h1>
              <p className="text-xs text-slate-500">Template Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {validationStatus === 'valid' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                Valid YAML
              </div>
            )}
            {validationStatus === 'invalid' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold max-w-[min(24rem,40vw)]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate" title={validationMessage ?? undefined}>
                  Invalid YAML
                </span>
              </div>
            )}
            <button
              onClick={() => setShowWebhookModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
            >
              <Webhook className="w-4 h-4" />
              Get Webhook
            </button>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={updateYaml.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveYaml}
                  disabled={updateYaml.isPending || draftYaml === yamlContent}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition disabled:opacity-50"
                >
                  {updateYaml.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save YAML
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/20 hover:bg-primary/5 rounded-lg transition disabled:opacity-50"
            >
              {isValidating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isValidating ? 'Validating...' : 'Validate YAML'}
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition disabled:opacity-50"
            >
              {isDeploying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {isDeploying ? 'Deploying...' : 'Deploy Template'}
            </button>
          </div>
        </header>

        {isEditing && updateYaml.isError && (
          <div
            role="alert"
            className="shrink-0 px-6 py-2.5 bg-rose-50 border-b border-rose-100 text-sm text-rose-800"
          >
            {apiErrorMessage(updateYaml.error)}
          </div>
        )}

        {validationStatus === 'invalid' && validationMessage && (
          <div
            role="alert"
            className="shrink-0 px-6 py-2.5 bg-rose-50 border-b border-rose-100 text-sm text-rose-800 font-mono whitespace-pre-wrap break-words"
          >
            {validationMessage}
          </div>
        )}

        {/* Main editor + optional YAML preview */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {isEditing ? (
            <>
              <section
                className={`min-h-0 flex flex-col bg-white border-r border-slate-200 ${
                  editView === 'raw' || (editView === 'structured' && !yamlPreviewOpen)
                    ? 'flex-1 min-w-0'
                    : 'w-[55%] min-w-0'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-mono text-sm">📄</span>
                    <span className="font-semibold text-sm text-slate-700">{template.id}.yaml</span>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => trySetStructuredView()}
                      className={`px-3 py-1.5 ${editView === 'structured' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      Structured
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditView('raw')}
                      className={`px-3 py-1.5 ${editView === 'raw' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      Raw YAML
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto yaml-editor px-2 py-2">
                  {editView === 'structured' ? (
                    <WorkflowEditor yaml={draftYaml} onYamlChange={setDraftYaml} />
                  ) : (
                    <div className="flex min-h-0 h-full">
                      <div
                        ref={lineNumbersRef}
                        className="py-4 px-2 text-right text-slate-300 font-mono text-sm select-none border-r border-slate-100 bg-slate-50/50 overflow-y-auto shrink-0"
                      >
                        {lineNumbers.map((n) => (
                          <div key={n} className="leading-relaxed h-[1.625rem]">
                            {n}
                          </div>
                        ))}
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={draftYaml}
                        onChange={(e) => setDraftYaml(e.target.value)}
                        onScroll={syncLineScroll}
                        spellCheck={false}
                        className="flex-1 min-h-0 min-w-0 py-4 px-3 font-mono text-sm text-slate-700 bg-white border-0 resize-none focus:ring-0 focus:outline-none overflow-y-auto overflow-x-auto whitespace-pre"
                        aria-label="Workflow YAML"
                      />
                    </div>
                  )}
                </div>
              </section>

              {editView === 'structured' && yamlPreviewOpen && (
                <section className="w-[45%] min-w-0 min-h-0 flex flex-col bg-slate-50 border-l border-slate-200">
                  <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        Live YAML preview
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">Updates as you edit the structured workflow.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setYamlPreviewOpen(false)}
                      className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                      aria-label="Hide YAML preview"
                      title="Hide preview"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto yaml-editor py-4 px-4 font-mono text-sm">
                    <div className="text-slate-700 space-y-0">
                      {previewLines.map((line, i) => (
                        <div
                          key={i}
                          className="leading-relaxed min-h-[1.625rem] whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: highlightYAMLLine(line) || '&nbsp;' }}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {editView === 'structured' && !yamlPreviewOpen && (
                <div className="w-10 shrink-0 min-h-0 flex flex-col items-center border-l border-slate-200 bg-slate-50 pt-3">
                  <button
                    type="button"
                    onClick={() => setYamlPreviewOpen(true)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition"
                    aria-label="Show YAML preview"
                    title="Show preview"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <section className="w-full min-h-0 flex flex-col bg-white border-r border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-mono text-sm">📄</span>
                  <span className="font-semibold text-sm text-slate-700">{template.id}.yaml</span>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto yaml-editor">
                <div className="py-6 px-3">
                  {yamlLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-2 font-mono text-sm">
                      <div className="w-10 shrink-0 py-0 pr-2 text-right text-slate-300 select-none tabular-nums leading-relaxed border-r border-slate-100 bg-slate-50/50">
                        {i + 1}
                      </div>
                      <div
                        className="min-w-0 flex-1 text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{ __html: highlightYAMLLine(line) || '&nbsp;' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Webhook className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Webhook Configuration</h2>
                  <p className="text-sm text-slate-500">Trigger runs via external integrations</p>
                </div>
              </div>
              <button
                onClick={() => setShowWebhookModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Webhook URL */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono text-slate-700 break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold whitespace-nowrap"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* HTTP Method */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  HTTP Method
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-sm font-bold">
                    POST
                  </span>
                  <span className="text-sm text-slate-500">Content-Type: application/json</span>
                </div>
              </div>

              {/* Sample Payload - Single */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Single Run Payload
                </label>
                <div className="relative">
                  <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <code className="text-sm font-mono text-emerald-400">
                      {samplePayloadJson}
                    </code>
                  </pre>
                  <button
                    onClick={handleCopyPayload}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedPayload ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Use this to trigger a single run with one order
                </p>
              </div>

              {/* Sample Payload - Batch */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Batch Run Payload (Multiple Orders)
                </label>
                <div className="relative">
                  <pre className="bg-slate-800 rounded-xl p-4 overflow-x-auto border border-indigo-500/30">
                    <code className="text-sm font-mono text-indigo-400">
                      {batchPayloadJson}
                    </code>
                  </pre>
                  <button
                    onClick={handleCopyBatch}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedBatch ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Use this to trigger multiple runs in one request. Each item in the orders array will create a separate run.
                </p>
              </div>

              {/* Usage Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h4 className="text-sm font-bold text-blue-900 mb-2">How to use</h4>
                <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
                  <li>Copy the Webhook URL above</li>
                  <li>Use it in your external system (Postman, Zapier, etc.)</li>
                  <li>Send single payload for one run, or batch payload for multiple runs</li>
                  <li>All runs will be triggered automatically</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowWebhookModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
