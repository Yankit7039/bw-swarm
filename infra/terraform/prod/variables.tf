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

