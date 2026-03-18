variable "name_prefix" {
  description = "Prefix used to name the EKS cluster and IAM roles."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID to deploy the cluster into."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the EKS cluster and node group."
  type        = list(string)
}

variable "kubernetes_version" {
  description = "EKS control plane version."
  type        = string
  default     = "1.29"
}

variable "platform_version" {
  description = "EKS platform version."
  type        = string
  default     = "eks.66"
}

variable "service_ipv4_cidr" {
  description = "EKS service IPv4 CIDR."
  type        = string
  default     = "172.20.0.0/16"
}

variable "node_group_name" {
  description = "EKS managed node group name."
  type        = string
  default     = "swarm-prod-managed-ng"
}

variable "node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  type        = number
  default     = 2
}

variable "node_min_size" {
  type        = number
  default     = 1
}

variable "node_max_size" {
  type        = number
  default     = 4
}

variable "node_disk_size" {
  description = "Disk size (GiB) for nodes."
  type        = number
  default     = 20
}

variable "node_update_max_unavailable" {
  description = "Max unavailable percentage/number during updates."
  type        = number
  default     = 1
}

