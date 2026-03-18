output "cluster_name" {
  value       = aws_eks_cluster.this.name
  description = "EKS cluster name."
}

output "cluster_endpoint" {
  value       = aws_eks_cluster.this.endpoint
  description = "EKS cluster API endpoint."
}

output "cluster_certificate_authority_data" {
  value       = aws_eks_cluster.this.certificate_authority[0].data
  description = "Base64-encoded EKS cluster CA data."
}

output "cluster_security_group_id" {
  value       = aws_security_group.cluster.id
  description = "Security group ID used for cluster networking (source for RDS ingress in state)."
}

output "node_security_group_id" {
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  description = "EKS-managed security group ID associated with node ENIs (use for RDS ingress)."
}

output "oidc_provider_arn" {
  value       = aws_iam_openid_connect_provider.this.arn
  description = "OIDC provider ARN for IRSA."
}

output "oidc_provider_url" {
  value       = aws_iam_openid_connect_provider.this.url
  description = "OIDC provider URL without https://."
}

