export interface AdapterTool {
  tool_name: string
  mcp_tool_name: string
  description: string | null
  input_schema: Record<string, unknown>
  docstring_warnings: string[] | null
  updated_at: string | null
}

export interface Adapter {
  adapter_name: string
  tool_count: number
  tools: AdapterTool[]
}
