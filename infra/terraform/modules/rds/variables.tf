variable "name_prefix" {
  description = "Prefix used to name the RDS resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs used for the DB subnet group."
  type        = list(string)
}

variable "eks_node_security_group_id" {
  description = "EKS node security group ID allowed to connect to the DB on 5432."
  type        = string
}

variable "db_password" {
  description = "Database password."
  type        = string
  sensitive   = true
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "swarm"
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "swarm"
}

variable "engine" {
  description = "Database engine."
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "Database engine version."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.small"
}

variable "allocated_storage" {
  description = "Allocated storage (GB)."
  type        = number
  default     = 50
}

variable "storage_type" {
  description = "Storage type."
  type        = string
  default     = "gp3"
}

variable "iops" {
  description = "IOPS for gp3."
  type        = number
  default     = 3000
}

variable "storage_throughput" {
  description = "Storage throughput for gp3."
  type        = number
  default     = 125
}

variable "kms_key_id" {
  description = "KMS key ARN used for storage encryption."
  type        = string
  default     = "arn:aws:kms:ap-southeast-1:718277287766:key/55bf5f07-f7c0-4611-ab24-90bfad6c2aed"
}

