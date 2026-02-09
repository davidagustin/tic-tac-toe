variable "project_name" {
  type    = string
  default = "ttt"
}

variable "environment" {
  type    = string
  default = "prod"
}

# ─── Generate Random Secrets ───────────────────────
# Terraform generates these once, stores them in SSM,
# and never needs to regenerate unless you taint them.

resource "random_password" "postgres" {
  length  = 32
  special = false  # Avoids URL-encoding issues in connection strings
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

# ─── SSM Parameters ───────────────────────────────

locals {
  prefix = "/${var.project_name}/${var.environment}"
}

# Database
resource "aws_ssm_parameter" "postgres_user" {
  name  = "${local.prefix}/database/username"
  type  = "String"
  value = "ttt_user"
  tags  = { Project = var.project_name }
}

resource "aws_ssm_parameter" "postgres_password" {
  name  = "${local.prefix}/database/password"
  type  = "SecureString"
  value = random_password.postgres.result
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "postgres_db" {
  name  = "${local.prefix}/database/name"
  type  = "String"
  value = "ttt_db"
  tags  = { Project = var.project_name }
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.prefix}/database/url"
  type  = "SecureString"
  value = "postgresql://ttt_user:${random_password.postgres.result}@postgres:5432/ttt_db"
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

# Redis
resource "aws_ssm_parameter" "redis_password" {
  name  = "${local.prefix}/redis/password"
  type  = "SecureString"
  value = random_password.redis.result
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "${local.prefix}/redis/url"
  type  = "SecureString"
  value = "redis://:${random_password.redis.result}@redis:6379"
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

# JWT
resource "aws_ssm_parameter" "jwt_access_secret" {
  name  = "${local.prefix}/jwt/access-secret"
  type  = "SecureString"
  value = random_password.jwt_access.result
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "${local.prefix}/jwt/refresh-secret"
  type  = "SecureString"
  value = random_password.jwt_refresh.result
  tags  = { Project = var.project_name }
  lifecycle { ignore_changes = [value] }
}

# App config (non-sensitive)
resource "aws_ssm_parameter" "node_env" {
  name  = "${local.prefix}/app/node-env"
  type  = "String"
  value = "production"
  tags  = { Project = var.project_name }
}

resource "aws_ssm_parameter" "port" {
  name  = "${local.prefix}/app/port"
  type  = "String"
  value = "3001"
  tags  = { Project = var.project_name }
}

# OAuth (you'll update these manually after creating Google credentials)
resource "aws_ssm_parameter" "google_client_id" {
  name  = "${local.prefix}/oauth/google-client-id"
  type  = "SecureString"
  value = "placeholder-update-via-aws-console"
  tags  = { Project = var.project_name }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name  = "${local.prefix}/oauth/google-client-secret"
  type  = "SecureString"
  value = "placeholder-update-via-aws-console"
  tags  = { Project = var.project_name }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_callback_url" {
  name  = "${local.prefix}/oauth/google-callback-url"
  type  = "String"
  value = "https://api.yourdomain.com/api/auth/google/callback"
  tags  = { Project = var.project_name }

  lifecycle {
    ignore_changes = [value]
  }
}

# ─── IAM Policy for Reading Secrets ───────────────

resource "aws_iam_policy" "read_secrets" {
  name        = "${var.project_name}-read-secrets"
  description = "Allow reading SSM parameters for ${var.project_name}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadParameters"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:*:*:parameter${local.prefix}",
          "arn:aws:ssm:*:*:parameter${local.prefix}/*"
        ]
      },
      {
        Sid    = "DecryptSecureStrings"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.us-west-2.amazonaws.com"
          }
        }
      }
    ]
  })
}

# ─── Outputs ──────────────────────────────────────

output "secrets_policy_arn" {
  value = aws_iam_policy.read_secrets.arn
}

output "parameter_prefix" {
  value = local.prefix
}
