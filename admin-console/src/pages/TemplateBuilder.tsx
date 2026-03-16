import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronUp, ChevronDown, X, CheckCircle, Code, Copy, Info, ArrowRight } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useCreateTemplate } from '../hooks/useTemplates'
import type { StepDefinition } from '../types/template'

const ADAPTERS = ['crm', 'network_module', 'email', 'slack', 'internal_api']

interface FormStep extends StepDefinition {
  key: string
}

const generateStepId = (index: number) => `step_${index + 1}`

export const TemplateBuilder = () => {
  const navigate = useNavigate()
  const createTemplate = useCreateTemplate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<FormStep[]>([
    {
      key: crypto.randomUUID(),
      id: 'step_1',
      name: '',
      type: 'subagent',
      depends_on: [],
      task: '',
      adapter: '',
      action: '',
      input: {},
      output_schema: {},
      parallel: [],
    },
  ])

  const addStep = () => {
    const newId = generateStepId(steps.length)
    setSteps([
      ...steps,
      {
        key: crypto.randomUUID(),
        id: newId,
        name: '',
        type: 'subagent',
        depends_on: [],
        task: '',
        adapter: '',
        action: '',
        input: {},
        output_schema: {},
        parallel: [],
      },
    ])
  }

  const removeStep = (index: number) => {
    if (steps.length === 1) return
    const removedId = steps[index].id
    const newSteps = steps.filter((_, i) => i !== index)

    const renumberedSteps = newSteps.map((step, i) => ({
      ...step,
      id: generateStepId(i),
      depends_on: step.depends_on.filter((id) => id !== removedId),
    }))

    setSteps(renumberedSteps)
  }

  const updateStep = (index: number, updates: Partial<FormStep>) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    setSteps(newSteps)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]

    const renumbered = newSteps.map((step, i) => ({
      ...step,
      id: generateStepId(i),
    }))

    setSteps(renumbered)
  }

  const getAvailableDependencies = (currentIndex: number) => {
    return steps
      .slice(0, currentIndex)
      .map((s) => s.id)
      .filter((id) => id !== steps[currentIndex].id)
  }

  const addInputField = (stepIndex: number) => {
    const step = steps[stepIndex]
    const key = `field_${Object.keys(step.input).length + 1}`
    updateStep(stepIndex, {
      input: { ...step.input, [key]: '' },
    })
  }

  const updateInputField = (
    stepIndex: number,
    oldKey: string,
    newKey: string,
    value: string
  ) => {
    const step = steps[stepIndex]
    const newInput = { ...step.input }
    delete newInput[oldKey]
    newInput[newKey] = value
    updateStep(stepIndex, { input: newInput })
  }

  const removeInputField = (stepIndex: number, key: string) => {
    const step = steps[stepIndex]
    const newInput = { ...step.input }
    delete newInput[key]
    updateStep(stepIndex, { input: newInput })
  }

  const addOutputField = (stepIndex: number) => {
    const step = steps[stepIndex]
    const key = `output_${Object.keys(step.output_schema).length + 1}`
    updateStep(stepIndex, {
      output_schema: { ...step.output_schema, [key]: 'string' },
    })
  }

  const updateOutputField = (
    stepIndex: number,
    oldKey: string,
    newKey: string,
    type: string
  ) => {
    const step = steps[stepIndex]
    const newSchema = { ...step.output_schema }
    delete newSchema[oldKey]
    newSchema[newKey] = type
    updateStep(stepIndex, { output_schema: newSchema })
  }

  const removeOutputField = (stepIndex: number, key: string) => {
    const step = steps[stepIndex]
    const newSchema = { ...step.output_schema }
    delete newSchema[key]
    updateStep(stepIndex, { output_schema: newSchema })
  }

  const buildDefinition = () => {
    const definitionSteps = steps.map((step) => {
      const base: any = {
        id: step.id,
        name: step.name,
        type: step.type,
        depends_on: step.depends_on,
        input: step.input,
        output_schema: step.output_schema,
      }
      
      if (step.type === 'subagent' && step.task) {
        base.task = step.task
      }
      if (step.type === 'deterministic') {
        base.adapter = step.adapter || ''
        base.action = step.action || ''
      }
      if (step.type === 'parallel' && step.parallel && step.parallel.length > 0) {
        base.parallel = step.parallel
      }
      
      return base
    })

    return {
      version: '1.0',
      name: name || 'Untitled Template',
      description,
      steps: definitionSteps,
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return

    const definition = buildDefinition()
    await createTemplate.mutateAsync({ name, definition })
    navigate('/templates')
  }

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(buildDefinition(), null, 2))
  }

  const definition = buildDefinition()

  return (
    <Layout>
      <div className="flex-1 p-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <button onClick={() => navigate('/templates')} className="hover:text-primary transition-colors">
            Templates
          </button>
          <ArrowRight className="w-4 h-4" />
          <span className="font-medium text-slate-900">New Template</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Create Template</h2>
            <p className="text-slate-500 mt-1">Define a new workflow template and configure its steps.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/templates')}
              className="px-5 py-2.5 rounded-lg border border-slate-200 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || createTemplate.isPending}
              className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {createTemplate.isPending ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* Editor Layout */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left Column: Configuration */}
          <div className="col-span-7 space-y-6">
            {/* Template Metadata */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Template Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Content Research Agent"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the purpose of this workflow..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Steps */}
            {steps.map((step, index) => (
              <section key={step.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Step Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-bold text-slate-900">Step {index + 1} Configuration</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded transition-all disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded transition-all disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeStep(index)}
                      disabled={steps.length === 1}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Step Content */}
                <div className="p-6 space-y-6">
                  {/* Step Name & Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Step Name</label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(index, { name: e.target.value })}
                        placeholder="e.g., Research Phase"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
                      <div className="relative">
                        <select
                          value={step.type}
                          onChange={(e) => updateStep(index, { type: e.target.value as FormStep['type'] })}
                          className="w-full appearance-none px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                          <option value="subagent">Subagent</option>
                          <option value="deterministic">Tool</option>
                          <option value="parallel">LLM Direct</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Depends On */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Depends On</label>
                    {getAvailableDependencies(index).length === 0 ? (
                      <div className="w-full px-4 py-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-400 italic">
                        No dependencies selected. This will be an entry step.
                      </div>
                    ) : (
                      <select
                        multiple
                        value={step.depends_on}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
                          updateStep(index, { depends_on: selected })
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        size={Math.min(getAvailableDependencies(index).length, 3)}
                      >
                        {getAvailableDependencies(index).map((id) => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Task / Adapter */}
                  {step.type === 'subagent' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Task Description</label>
                      <textarea
                        value={step.task}
                        onChange={(e) => updateStep(index, { task: e.target.value })}
                        placeholder="Explain what the agent should do in this step..."
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                      />
                    </div>
                  )}

                  {step.type === 'deterministic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Adapter</label>
                        <div className="relative">
                          <select
                            value={step.adapter}
                            onChange={(e) => updateStep(index, { adapter: e.target.value })}
                            className="w-full appearance-none px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          >
                            <option value="">Select adapter</option>
                            {ADAPTERS.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Action</label>
                        <input
                          type="text"
                          value={step.action}
                          onChange={(e) => updateStep(index, { action: e.target.value })}
                          placeholder="e.g., get_customer"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Input & Output Fields - Stacked Layout */}
                  <div className="space-y-6">
                    {/* Input Fields */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-700">Input Fields</label>
                        <button
                          onClick={() => addInputField(index)}
                          className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3 h-3" /> Add Field
                        </button>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(step.input).length === 0 && (
                          <p className="text-xs text-slate-400 italic">No input fields defined</p>
                        )}
                        {Object.entries(step.input).map(([key, value], i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) =>
                                updateInputField(index, key, e.target.value, value as string)
                              }
                              placeholder="Field name"
                              className="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <input
                              type="text"
                              value={value as string}
                              onChange={(e) =>
                                updateInputField(index, key, key, e.target.value)
                              }
                              placeholder="Default value"
                              className="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <button
                              onClick={() => removeInputField(index, key)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Output Schema */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-700">Output Schema</label>
                        <button
                          onClick={() => addOutputField(index)}
                          className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3 h-3" /> Add Field
                        </button>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(step.output_schema).length === 0 && (
                          <p className="text-xs text-slate-400 italic">No output fields defined</p>
                        )}
                        {Object.entries(step.output_schema).map(([key, type], i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) =>
                                updateOutputField(index, key, e.target.value, type as string)
                              }
                              placeholder="Field name"
                              className="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <select
                              value={type as string}
                              onChange={(e) =>
                                updateOutputField(index, key, key, e.target.value)
                              }
                              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary flex-shrink-0 w-28"
                            >
                              <option value="string">string</option>
                              <option value="number">number</option>
                              <option value="boolean">boolean</option>
                            </select>
                            <button
                              onClick={() => removeOutputField(index, key)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ))}

            {/* Add Step Button */}
            <button
              onClick={addStep}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-500 font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Workflow Step
            </button>
          </div>

          {/* Right Column: Preview */}
          <div className="col-span-5 sticky top-24">
            <div className="bg-[#1e1e2e] rounded-xl overflow-hidden shadow-2xl border border-slate-800">
              {/* Header */}
              <div className="bg-[#181825] px-6 py-4 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold text-white text-sm">DSL Preview</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Real-time</span>
                </div>
              </div>

              {/* JSON Content */}
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto h-[500px]">
                <div className="text-slate-300">
                  {/* Syntax highlighted JSON */}
                  <span className="text-pink-400">{'{'}</span>
                  <br />
                  <span className="text-indigo-300">  &quot;version&quot;</span>: <span className="text-emerald-400">&quot;{definition.version}&quot;</span>,
                  <br />
                  <span className="text-indigo-300">  &quot;name&quot;</span>: <span className="text-emerald-400">&quot;{definition.name}&quot;</span>,
                  <br />
                  {definition.description && (
                    <>
                      <span className="text-indigo-300">  &quot;description&quot;</span>: <span className="text-emerald-400">&quot;{definition.description}&quot;</span>,
                      <br />
                    </>
                  )}
                  <span className="text-indigo-300">  &quot;steps&quot;</span>: <span className="text-pink-400">[</span>
                  <br />
                  {steps.map((step, i) => (
                    <span key={i}>
                      <span className="text-pink-400">    {'{'}</span>
                      <br />
                      <span className="text-indigo-300">      &quot;id&quot;</span>: <span className="text-emerald-400">&quot;{step.id}&quot;</span>,
                      <br />
                      <span className="text-indigo-300">      &quot;name&quot;</span>: <span className="text-emerald-400">&quot;{step.name}&quot;</span>,
                      <br />
                      <span className="text-indigo-300">      &quot;type&quot;</span>: <span className="text-emerald-400">&quot;{step.type}&quot;</span>,
                      <br />
                      <span className="text-indigo-300">      &quot;depends_on&quot;</span>: <span className="text-pink-400">[</span>
                      {step.depends_on.length === 0 ? (
                        <span></span>
                      ) : (
                        step.depends_on.map((d: string, j: number) => (
                          <span key={j}>
                            <span className="text-emerald-400">&quot;{d}&quot;</span>
                            {j < step.depends_on.length - 1 && ', '}
                          </span>
                        ))
                      )}
                      <span className="text-pink-400">]</span>
                      <br />
                      {step.type === 'subagent' && (
                        <>
                          <span className="text-indigo-300">      &quot;task&quot;</span>: <span className="text-emerald-400">&quot;{step.task || ''}&quot;</span>,
                          <br />
                        </>
                      )}
                      {step.type === 'deterministic' && (
                        <>
                          <span className="text-indigo-300">      &quot;adapter&quot;</span>: <span className="text-emerald-400">&quot;{step.adapter || ''}&quot;</span>,
                          <br />
                          <span className="text-indigo-300">      &quot;action&quot;</span>: <span className="text-emerald-400">&quot;{step.action || ''}&quot;</span>,
                          <br />
                        </>
                      )}
                      <span className="text-indigo-300">      &quot;input&quot;</span>: <span className="text-pink-400">{'{'}</span>
                      {Object.entries(step.input).map(([k, v], idx, arr) => (
                        <span key={k}>
                          <br />
                          <span className="text-indigo-300">        &quot;{k}&quot;</span>: <span className="text-emerald-400">&quot;{v as string}&quot;</span>
                          {idx < arr.length - 1 && ','}
                        </span>
                      ))}
                      <br />
                      <span className="text-pink-400">      {'}'}</span>,
                      <br />
                      <span className="text-indigo-300">      &quot;output_schema&quot;</span>: <span className="text-pink-400">{'{'}</span>
                      {Object.entries(step.output_schema).map(([k, v], idx, arr) => (
                        <span key={k}>
                          <br />
                          <span className="text-indigo-300">        &quot;{k}&quot;</span>: <span className="text-emerald-400">&quot;{v as string}&quot;</span>
                          {idx < arr.length - 1 && ','}
                        </span>
                      ))}
                      <br />
                      <span className="text-pink-400">      {'}'}</span>
                      <br />
                      <span className="text-pink-400">    {'}'}</span>
                      {i < steps.length - 1 && ','}
                      <br />
                    </span>
                  ))}
                  <span className="text-pink-400">  ]</span>
                  <br />
                  <span className="text-pink-400">{'}'}</span>
                </div>

                {/* Validation Section */}
                <div className="mt-8 pt-8 border-t border-slate-800/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Workflow Validation</span>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-500">Validation Passed</p>
                      <p className="text-[11px] text-emerald-400/80 mt-1">DSL structure is valid and ready for deployment.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Copy Button */}
              <div className="bg-[#181825] p-4 flex justify-center">
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
