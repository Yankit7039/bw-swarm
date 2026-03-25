variable "region" {
  description = "AWS region."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment_prefix" {
  description = "Environment prefix used in resource names (e.g. swarm-prod)."
  type        = string
  default     = "swarm-prod"
}

variable "openrouter_api_key" {
  description = "OpenRouter API key stored in Secrets Manager."
  type        = string
  sensitive   = true
  # Remote state already contains a placeholder value.
  default = "REPLACE_ME"
}

variable "agentmail_api_key" {
  description = "AgentMail API key stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "agentmail_inbox_id" {
  description = "AgentMail inbox id (sender inbox) stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "jira_email" {
  description = "Jira Cloud account email stored in Secrets Manager (adapter Jira MCP tools)."
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "jira_api_token" {
  description = "Jira Cloud API token stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "jira_base" {
  description = "Jira Cloud site base URL stored in Secrets Manager (jira-base key)."
  type        = string
  default     = "https://swarm-bw.atlassian.net"
}

variable "jira_webhook_secret" {
  description = "Bearer token for Runtime Jira webhook; stored as jira-webhook-secret in Secrets Manager."
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for singledigit.team."
  type        = string
  default     = "Z01004903J4JEPQ9IWE8V"
}

variable "subdomain" {
  description = "Subdomain used for Route 53 DNS records e.g. swarm for prod, dev for testing"
  type        = string
  default     = "swarm"
}
