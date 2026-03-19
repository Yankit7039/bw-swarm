output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state."
  value       = aws_s3_bucket.state.id
}

output "lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking."
  value       = aws_dynamodb_table.locks.name
}

output "region" {
  description = "AWS region where the backend resources are deployed."
  value       = var.region
}
