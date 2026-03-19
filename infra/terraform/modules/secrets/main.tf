locals {
  secret_path = "${var.name_prefix}/${var.secret_name}"

  database_url = "postgresql+asyncpg://swarm:${var.db_password}@${var.db_endpoint}:5432/swarm"

  secret_payload = jsonencode({
    "database-url"      = local.database_url
    "openrouter-api-key" = "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"
  })
}

resource "aws_secretsmanager_secret" "adk" {
  name                    = local.secret_path
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "adk" {
  secret_id     = aws_secretsmanager_secret.adk.id
  secret_string = local.secret_payload
}

