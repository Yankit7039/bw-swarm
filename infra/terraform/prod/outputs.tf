output "eks_cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "region" {
  description = "AWS region."
  value       = var.region
}

output "vpc_id" {
  description = "VPC ID."
  value       = module.vpc.vpc_id
}

output "ecr_repository_urls" {
  description = "Map of ECR repository name to repository URL."
  value       = module.ecr.repository_urls
}

output "rds_endpoint" {
  description = "RDS endpoint hostname."
  value       = module.rds.rds_endpoint
}

output "adk_secrets_arn" {
  description = "ARN of the Secrets Manager secret holding ADK settings."
  value       = module.secrets.secret_arn
}

output "runtime_url" {
  value = "https://runtime.${var.subdomain}.singledigit.team"
}

output "api_url" {
  value = "https://api.${var.subdomain}.singledigit.team"
}
