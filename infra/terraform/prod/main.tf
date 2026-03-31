terraform {
  backend "s3" {
    bucket         = "swarm-terraform-state-718277287766"
    dynamodb_table = "swarm-terraform-locks"
    key            = "swarm/prod/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

locals {
  name_prefix = var.environment_prefix
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name,
      "--region",
      var.region
    ]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name,
        "--region",
        var.region
      ]
    }
  }
}

module "vpc" {
  source = "../modules/vpc"

  region      = var.region
  name_prefix = local.name_prefix

  vpc_cidr             = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
}

module "ecr" {
  source = "../modules/ecr"

  name_prefix = var.environment_prefix == "swarm-prod" ? "" : var.environment_prefix

  repository_names = [
    "swarm-core",
    "stuck-order-adk",
    "esim-activation-adk",
    "number-porting-adk",
    "ticket-email-routing-adk",
    "network-ops-l1l2-triage-adk",
    "swarm-adapter",
    "swarm-runtime",
    "swarm-admin-api",
  ]
}

module "eks" {
  source = "../modules/eks"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id

  private_subnet_ids = module.vpc.private_subnet_ids

  kubernetes_version = "1.31"
  platform_version   = "eks.66"
  service_ipv4_cidr  = "172.20.0.0/16"

  node_group_name             = "${local.name_prefix}-managed-ng"
  node_instance_types         = ["t3.medium"]
  node_desired_size           = 2
  node_min_size               = 1
  node_max_size               = 4
  node_disk_size              = 20
  node_update_max_unavailable = 1
}

resource "random_password" "db" {
  length = 24

  lower   = true
  upper   = true
  numeric = true
  special = true

  min_lower   = 0
  min_upper   = 0
  min_numeric = 0
  min_special = 0

  override_special = "!#$%*()-_=+[]{}<>:?"
}

module "rds" {
  source = "../modules/rds"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id

  private_subnet_ids = module.vpc.private_subnet_ids

  eks_node_security_group_id = module.eks.node_security_group_id
  db_password                = random_password.db.result
}

# Redis queue (runtime worker + admin API enqueue). ElastiCache ~5–10 min to provision.
resource "aws_security_group" "elasticache" {
  name        = "${local.name_prefix}-elasticache-redis"
  description = "Redis ElastiCache; ingress from EKS nodes only"
  vpc_id      = module.vpc.vpc_id

  depends_on = [module.vpc]

  ingress {
    description     = "Redis from EKS node security group"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-elasticache-redis"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id         = "${local.name_prefix}-redis"
  engine             = "redis"
  engine_version     = "7.1"
  node_type          = "cache.t3.micro"
  num_cache_nodes    = 1
  port               = 6379
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.elasticache.id]
}

module "secrets" {
  source = "../modules/secrets"

  name_prefix             = local.name_prefix
  recovery_window_in_days = 0

  openrouter_api_key = var.openrouter_api_key
  agentmail_api_key  = var.agentmail_api_key
  agentmail_inbox_id = var.agentmail_inbox_id
  jira_email            = var.jira_email
  jira_api_token        = var.jira_api_token
  jira_base             = var.jira_base
  jira_webhook_secret        = var.jira_webhook_secret
  agentmail_webhook_secret   = var.agentmail_webhook_secret
  db_endpoint           = module.rds.rds_endpoint
  db_password           = random_password.db.result

  redis_url = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"

  depends_on = [aws_elasticache_cluster.redis]
}

data "aws_iam_policy_document" "irsa_assume_alb_controller" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:kube-system:aws-load-balancer-controller"]
    }
  }
}

data "aws_iam_policy_document" "irsa_assume_external_secrets" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:external-secrets:external-secrets"]
    }
  }
}

resource "aws_iam_policy" "alb_controller" {
  name   = "${local.name_prefix}-alb-controller-policy"
  policy = file("${path.module}/iam/aws-load-balancer-controller-iam-policy.json")
}

resource "aws_iam_policy" "external_secrets" {
  name   = "${local.name_prefix}-external-secrets-policy"
  policy = "{\"Statement\":[{\"Action\":[\"secretsmanager:GetSecretValue\",\"secretsmanager:DescribeSecret\",\"secretsmanager:ListSecrets\"],\"Effect\":\"Allow\",\"Resource\":\"*\"}],\"Version\":\"2012-10-17\"}"
}

resource "aws_iam_role" "alb_controller" {
  name               = "${local.name_prefix}-alb-controller-irsa"
  assume_role_policy = data.aws_iam_policy_document.irsa_assume_alb_controller.json
}

resource "aws_iam_role" "external_secrets" {
  name               = "${local.name_prefix}-external-secrets-irsa"
  assume_role_policy = data.aws_iam_policy_document.irsa_assume_external_secrets.json
}

resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = aws_iam_role.alb_controller.name
  policy_arn = aws_iam_policy.alb_controller.arn
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = "external-secrets"
  }

  wait_for_default_service_account = false
}

resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  chart      = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  version    = "3.1.0"

  create_namespace = false

  atomic            = false
  cleanup_on_fail   = false
  dependency_update = false

  render_subchart_notes = true

  wait      = true
  timeout   = 300
  skip_crds = false

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "region"
    value = var.region
  }

  set {
    name  = "vpcId"
    value = module.vpc.vpc_id
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.alb_controller.arn
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }
}

resource "null_resource" "wait_for_alb_webhook" {
  triggers = {
    helm_release_id = helm_release.aws_load_balancer_controller.id
  }

  depends_on = [helm_release.aws_load_balancer_controller]

  provisioner "local-exec" {
    working_dir = path.module
    command     = "python3 ${path.module}/scripts/wait_for_webhook.py || python ${path.module}/scripts/wait_for_webhook.py"
    environment = {
      CLUSTER_NAME = module.eks.cluster_name
      REGION       = var.region
      NAMESPACE    = "kube-system"
      DEPLOYMENT   = "aws-load-balancer-controller"
    }
  }
}

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  namespace  = "external-secrets"
  chart      = "external-secrets"
  repository = "https://charts.external-secrets.io"
  version    = "2.1.0"

  create_namespace = false

  depends_on = [
    kubernetes_namespace.external_secrets,
    null_resource.wait_for_alb_webhook,
  ]

  atomic            = false
  cleanup_on_fail   = false
  dependency_update = false

  render_subchart_notes = true

  wait      = true
  timeout   = 300
  skip_crds = false

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.external_secrets.arn
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "external-secrets"
  }
}

# --- ACM certificate for *.${var.subdomain}.singledigit.team ---
resource "aws_acm_certificate" "swarm_singledigit" {
  domain_name       = "*.${var.subdomain}.singledigit.team"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.swarm_singledigit.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "swarm_singledigit" {
  certificate_arn         = aws_acm_certificate.swarm_singledigit.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# --- Ingress (Terraform-managed for dependency ordering) ---
resource "kubernetes_ingress_v1" "ingress_runtime" {
  metadata {
    name      = "runtime-ingress"
    namespace = "default"
    annotations = {
      "kubernetes.io/ingress.class"                    = "alb"
      "alb.ingress.kubernetes.io/scheme"              = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"          = "ip"
      "alb.ingress.kubernetes.io/listen-ports"         = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
      "alb.ingress.kubernetes.io/ssl-redirect"         = "443"
      "alb.ingress.kubernetes.io/certificate-arn"      = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
      "alb.ingress.kubernetes.io/healthcheck-path"    = "/health"
    }
  }

  spec {
    ingress_class_name = "alb"
    rule {
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "runtime"
              port {
                number = 8000
              }
            }
          }
        }
      }
    }
  }

  wait_for_load_balancer = true

  depends_on = [
    aws_acm_certificate_validation.swarm_singledigit,
    helm_release.aws_load_balancer_controller,
    null_resource.wait_for_alb_webhook,
  ]
}

resource "kubernetes_ingress_v1" "ingress_admin_api" {
  metadata {
    name      = "admin-api-ingress"
    namespace = "default"
    annotations = {
      "kubernetes.io/ingress.class"                    = "alb"
      "alb.ingress.kubernetes.io/scheme"              = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"          = "ip"
      "alb.ingress.kubernetes.io/listen-ports"         = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
      "alb.ingress.kubernetes.io/ssl-redirect"         = "443"
      "alb.ingress.kubernetes.io/certificate-arn"      = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
      "alb.ingress.kubernetes.io/healthcheck-path"    = "/health"
    }
  }

  spec {
    ingress_class_name = "alb"
    rule {
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "admin-api"
              port {
                number = 8000
              }
            }
          }
        }
      }
    }
  }

  wait_for_load_balancer = true

  depends_on = [
    aws_acm_certificate_validation.swarm_singledigit,
    helm_release.aws_load_balancer_controller,
    null_resource.wait_for_alb_webhook,
  ]
}

resource "aws_route53_record" "runtime" {
  zone_id = var.route53_zone_id
  name    = "runtime.${var.subdomain}.singledigit.team"
  type    = "A"

  alias {
    name                   = kubernetes_ingress_v1.ingress_runtime.status[0].load_balancer[0].ingress[0].hostname
    zone_id                = "Z1LMS91P8CMLE5"
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "api.${var.subdomain}.singledigit.team"
  type    = "A"

  alias {
    name                   = kubernetes_ingress_v1.ingress_admin_api.status[0].load_balancer[0].ingress[0].hostname
    zone_id                = "Z1LMS91P8CMLE5"
    evaluate_target_health = false
  }
}

output "acm_certificate_arn" {
  value       = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
  description = "ACM certificate ARN for wildcard cert under singledigit.team (var.subdomain)"
}

