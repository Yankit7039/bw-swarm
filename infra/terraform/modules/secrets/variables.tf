variable "name_prefix" {
  description = "Prefix used to name secrets."
  type        = string
}

variable "secret_name" {
  description = "Secrets Manager secret name (without the prefix path)."
  type        = string
  default     = "adk-secrets"
}

variable "recovery_window_in_days" {
  description = "Secrets Manager deletion recovery window."
  type        = number
  default     = 0
}

variable "openrouter_api_key" {
  description = "OpenRouter API key stored in Secrets Manager."
  type        = string
  sensitive   = true
}

variable "agentmail_api_key" {
  description = "AgentMail API key stored in Secrets Manager."
  type        = string
  sensitive   = true
}

variable "agentmail_inbox_id" {
  description = "AgentMail inbox id (sender inbox) stored in Secrets Manager."
  type        = string
  sensitive   = true
}

variable "db_endpoint" {
  description = "RDS endpoint hostname used to build database URL."
  type        = string
}

variable "db_password" {
  description = "Database password stored in Secrets Manager (used to build database URL)."
  type        = string
  sensitive   = true
}

