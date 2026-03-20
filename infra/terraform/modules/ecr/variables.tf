variable "repository_names" {
  description = "ECR repository names to create/manage."
  type        = list(string)
}

variable "name_prefix" {
  description = "Optional prefix for ECR repository names"
  type        = string
  default     = ""
}

