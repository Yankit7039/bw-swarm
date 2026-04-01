/** Split MCP tool id (adapter__tool) into adapter and tool suffix. */
export function splitMcpTool(mcpToolName: string): { adapter: string; toolSuffix: string } {
  const idx = mcpToolName.indexOf('__')
  if (idx === -1) return { adapter: '', toolSuffix: mcpToolName }
  return { adapter: mcpToolName.slice(0, idx), toolSuffix: mcpToolName.slice(idx + 2) }
}

export function joinMcpTool(adapter: string, toolSuffix: string): string {
  if (!adapter) return toolSuffix
  return `${adapter}__${toolSuffix}`
}
