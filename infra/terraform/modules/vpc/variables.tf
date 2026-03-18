variable "region" {
  description = "AWS region to deploy into."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used to name VPC and networking resources."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (must be 1+ entries)."
  type        = list(string)
  default     = [
    "10.0.0.0/24",
    "10.0.1.0/24",
  ]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (must be 1+ entries)."
  type        = list(string)
  default     = [
    "10.0.10.0/24",
    "10.0.11.0/24",
  ]
}

