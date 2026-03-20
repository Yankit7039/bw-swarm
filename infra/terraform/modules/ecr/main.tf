resource "aws_ecr_repository" "this" {
  for_each = toset(var.repository_names)

  name                 = var.name_prefix != "" ? "${var.name_prefix}-${each.key}" : each.key
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "retain_last_30" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = "{\"rules\":[{\"action\":{\"type\":\"expire\"},\"description\":\"Retain last 30 images\",\"rulePriority\":1,\"selection\":{\"countNumber\":30,\"countType\":\"imageCountMoreThan\",\"tagStatus\":\"any\"}}]}"
}

