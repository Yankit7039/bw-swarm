resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-rds-sg"
  description = "RDS PostgreSQL security group"
  vpc_id      = var.vpc_id

  ingress = []
  egress  = []

  revoke_rules_on_delete = false
  tags                    = {}
}

resource "aws_security_group_rule" "db_egress" {
  type              = "egress"
  security_group_id = aws_security_group.db.id

  protocol    = "-1"
  from_port   = 0
  to_port     = 0
  cidr_blocks = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "db_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = var.eks_node_security_group_id
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  description = "Managed by Terraform"
  tags = {
    Name = "${var.name_prefix}-db-subnets"
  }
}

resource "aws_db_instance" "this" {
  identifier = "${var.name_prefix}-postgres"

  engine         = var.engine
  engine_version = var.engine_version

  instance_class = var.instance_class

  username = var.db_username
  password = var.db_password
  db_name  = var.db_name

  port = 5432

  allocated_storage = var.allocated_storage

  storage_type      = var.storage_type

  storage_encrypted = true
  kms_key_id        = var.kms_key_id

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name

  publicly_accessible        = false
  multi_az                   = false
  deletion_protection       = false

  apply_immediately         = true
  auto_minor_version_upgrade = true

  backup_retention_period = 7
  backup_target           = "region"
  backup_window           = "18:13-18:43"

  maintenance_window = "thu:20:53-thu:21:23"

  skip_final_snapshot = true
  delete_automated_backups = true

  enabled_cloudwatch_logs_exports = []
  ca_cert_identifier              = "rds-ca-rsa2048-g1"
  parameter_group_name           = "default.postgres16"
  option_group_name              = "default:postgres-16"
  engine_lifecycle_support      = "open-source-rds-extended-support"
  license_model                  = "postgresql-license"

  database_insights_mode = "standard"

  performance_insights_enabled = false
  performance_insights_retention_period = 0

  copy_tags_to_snapshot       = false
  dedicated_log_volume        = false
  customer_owned_ip_enabled  = false

  tags = {}
}

