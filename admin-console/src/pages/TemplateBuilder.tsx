import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useCreateTemplate } from '../hooks/useTemplates'
import type { StepDefinition } from '../types/template'

const ADAPTERS = ['crm', 'network_module', 'email', 'slack', 'internal_api']
const OUTPUT_TYPES = ['string', 'number', 'boolean']

interface FormStep extends StepDefinition {
  key: string
}

const generateStepId = (index: number) => `step_${index + 1}`

export const TemplateBuilder = () => {
  const navigate = useNavigate()
  const createTemplate = useCreateTemplate()

  const [name, setName] = useState('')
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

    // Remove dependencies on this step and renumber
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

    // Swap
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]

    // Renumber IDs
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
    const definitionSteps = steps.map((step) => ({
      id: step.id,
      name: step.name,
      type: step.type,
      depends_on: step.depends_on,
      ...(step.type === 'subagent' && { task: step.task }),
      ...(step.type === 'deterministic' && {
        adapter: step.adapter,
        action: step.action,
      }),
      ...(step.type === 'parallel' && { parallel: step.parallel }),
      input: step.input,
      output_schema: step.output_schema,
    }))

    return {
      version: '1.0',
      steps: definitionSteps,
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return

    const definition = buildDefinition()
    await createTemplate.mutateAsync({ name, definition })
    navigate('/templates')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Create Template</h2>
          <p className="text-gray-500">Define a new workflow template</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/templates')}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || createTemplate.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createTemplate.isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* Left: Form Builder */}
        <div className="overflow-auto space-y-4 pr-2">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Stuck Order Resolution"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.key}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-500">{step.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeStep(index)}
                      disabled={steps.length === 1}
                      className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Step Name
                      </label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) =>
                          updateStep(index, { name: e.target.value })
                        }
                        placeholder="e.g., Check CRM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Type
                      </label>
                      <select
                        value={step.type}
                        onChange={(e) =>
                          updateStep(index, { type: e.target.value as any })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="subagent">Subagent</option>
                        <option value="deterministic">Deterministic</option>
                        <option value="parallel">Parallel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Depends On
                    </label>
                    <select
                      multiple
                      value={step.depends_on}
                      onChange={(e) => {
                        const options = Array.from(e.target.selectedOptions).map(
                          (o) => o.value
                        )
                        updateStep(index, { depends_on: options })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      {getAvailableDependencies(index).map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Hold Ctrl/Cmd to select multiple
                    </p>
                  </div>

                  {step.type === 'subagent' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Task Description
                      </label>
                      <textarea
                        value={step.task}
                        onChange={(e) =>
                          updateStep(index, { task: e.target.value })
                        }
                        placeholder="Describe what this subagent should do..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  )}

                  {step.type === 'deterministic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Adapter
                        </label>
                        <select
                          value={step.adapter}
                          onChange={(e) =>
                            updateStep(index, { adapter: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Select adapter...</option>
                          {ADAPTERS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Action
                        </label>
                        <input
                          type="text"
                          value={step.action}
                          onChange={(e) =>
                            updateStep(index, { action: e.target.value })
                          }
                          placeholder="e.g., check_status"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Input Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-gray-600">
                        Input Fields
                      </label>
                      <button
                        onClick={() => addInputField(index)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + Add field
                      </button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(step.input).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) =>
                              updateInputField(index, key, e.target.value, value)
                            }
                            placeholder="Key"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <input
                            type="text"
                            value={value as string}
                            onChange={(e) =>
                              updateInputField(index, key, key, e.target.value)
                            }
                            placeholder="Value (use {{step_id.output.field}})"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <button
                            onClick={() => removeInputField(index, key)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output Schema */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-gray-600">
                        Output Schema
                      </label>
                      <button
                        onClick={() => addOutputField(index)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + Add field
                      </button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(step.output_schema).map(([key, type]) => (
                        <div key={key} className="flex gap-2">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) =>
                              updateOutputField(index, key, e.target.value, type)
                            }
                            placeholder="Field name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <select
                            value={type}
                            onChange={(e) =>
                              updateOutputField(index, key, key, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            {OUTPUT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeOutputField(index, key)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addStep}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Step
          </button>
        </div>

        {/* Right: JSON Preview */}
        <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
          <h3 className="text-gray-400 text-sm font-medium mb-2">DSL Preview</h3>
          <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
            {JSON.stringify(buildDefinition(), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
