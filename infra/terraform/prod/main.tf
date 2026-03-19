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

  vpc_cidr            = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
}

module "ecr" {
  source = "../modules/ecr"

  repository_names = [
    "stuck-order-adk",
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

  kubernetes_version = "1.29"
  platform_version   = "eks.66"
  service_ipv4_cidr  = "172.20.0.0/16"

  node_group_name            = "${local.name_prefix}-managed-ng"
  node_instance_types       = ["t3.medium"]
  node_desired_size         = 2
  node_min_size             = 1
  node_max_size             = 4
  node_disk_size            = 20
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
  db_password              = random_password.db.result
}

module "secrets" {
  source = "../modules/secrets"

  name_prefix = local.name_prefix
  recovery_window_in_days = 30

  openrouter_api_key = var.openrouter_api_key
  db_endpoint        = module.rds.rds_endpoint
  db_password        = random_password.db.result
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

data "http" "alb_controller_policy" {
  url = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json"

  request_headers = {
    Accept = "application/json"
  }
}

resource "aws_iam_policy" "alb_controller" {
  name   = "${local.name_prefix}-alb-controller-policy"
  policy = data.http.alb_controller_policy.response_body
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

  atomic             = false
  cleanup_on_fail   = false
  dependency_update = false

  render_subchart_notes = true

  wait    = true
  timeout = 300
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

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  namespace  = "external-secrets"
  chart      = "external-secrets"
  repository = "https://charts.external-secrets.io"
  version    = "2.1.0"

  create_namespace = false

  depends_on = [kubernetes_namespace.external_secrets]

  atomic             = false
  cleanup_on_fail   = false
  dependency_update = false

  render_subchart_notes = true

  wait    = true
  timeout = 300
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

# --- ACM certificate for *.swarm.singledigit.team (ap-southeast-1) ---
resource "aws_acm_certificate" "swarm_singledigit" {
  domain_name       = "*.swarm.singledigit.team"
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
      "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"      = "ip"
      "alb.ingress.kubernetes.io/healthcheck-path"  = "/health"
      "alb.ingress.kubernetes.io/listen-ports"     = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
      "alb.ingress.kubernetes.io/ssl-redirect"     = "443"
      "alb.ingress.kubernetes.io/certificate-arn"  = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
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

  depends_on = [aws_acm_certificate_validation.swarm_singledigit]
}

resource "kubernetes_ingress_v1" "ingress_admin_api" {
  metadata {
    name      = "admin-api-ingress"
    namespace = "default"
    annotations = {
      "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"      = "ip"
      "alb.ingress.kubernetes.io/healthcheck-path"  = "/health"
      "alb.ingress.kubernetes.io/listen-ports"     = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
      "alb.ingress.kubernetes.io/ssl-redirect"     = "443"
      "alb.ingress.kubernetes.io/certificate-arn"  = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
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

  depends_on = [aws_acm_certificate_validation.swarm_singledigit]
}

resource "time_sleep" "wait_for_alb" {
  depends_on = [
    helm_release.aws_load_balancer_controller,
    kubernetes_ingress_v1.ingress_runtime,
    kubernetes_ingress_v1.ingress_admin_api,
  ]

  create_duration = "90s"
}

data "aws_lb" "runtime" {
  tags = {
    "ingress.k8s.aws/stack" = "default/runtime-ingress"
  }
  depends_on = [time_sleep.wait_for_alb]
}

data "aws_lb" "admin_api" {
  tags = {
    "ingress.k8s.aws/stack" = "default/admin-api-ingress"
  }
  depends_on = [time_sleep.wait_for_alb]
}

resource "aws_route53_record" "runtime" {
  zone_id = var.route53_zone_id
  name    = "runtime.swarm.singledigit.team"
  type    = "A"

  alias {
    name                   = data.aws_lb.runtime.dns_name
    zone_id                = data.aws_lb.runtime.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "api.swarm.singledigit.team"
  type    = "A"

  alias {
    name                   = data.aws_lb.admin_api.dns_name
    zone_id                = data.aws_lb.admin_api.zone_id
    evaluate_target_health = false
  }
}

output "runtime_url" {
  value = "https://runtime.swarm.singledigit.team"
}

output "api_url" {
  value = "https://api.swarm.singledigit.team"
}

output "acm_certificate_arn" {
  value       = aws_acm_certificate_validation.swarm_singledigit.certificate_arn
  description = "ACM certificate ARN for *.swarm.singledigit.team"
}

