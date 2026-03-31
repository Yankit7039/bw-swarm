locals {
  secret_path = "${var.name_prefix}/${var.secret_name}"

  database_url = "postgresql+asyncpg://swarm:${var.db_password}@${var.db_endpoint}:5432/swarm"

  secret_payload = jsonencode({
    "database-url"       = local.database_url
    "openrouter-api-key" = var.openrouter_api_key
    "agentmail-api-key"  = var.agentmail_api_key
    "agentmail-inbox-id" = var.agentmail_inbox_id
    "jira-email"           = var.jira_email
    "jira-api-token"       = var.jira_api_token
    "jira-base"            = var.jira_base
    "jira-webhook-secret"       = var.jira_webhook_secret
    "agentmail-webhook-secret"  = var.agentmail_webhook_secret
    "redis-url"                 = var.redis_url
  })
}

resource "aws_secretsmanager_secret" "adk" {
  name                    = local.secret_path
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "adk" {
  secret_id     = aws_secretsmanager_secret.adk.id
  secret_string = local.secret_payload
}

