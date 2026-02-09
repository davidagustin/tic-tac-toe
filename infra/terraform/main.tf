terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ttt-terraform-state-8752"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "ttt-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Variables ──────────────────────────────────────

variable "aws_region" {
  default = "us-west-2"
}

variable "key_pair_name" {
  description = "Name of your EC2 key pair"
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR blocks allowed to SSH into the EC2 instance (e.g., [\"203.0.113.0/32\"])"
  type        = list(string)
}

# ─── VPC (Default) ─────────────────────────────────

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ─── Security Group ────────────────────────────────

resource "aws_security_group" "ttt_server" {
  name        = "ttt-server-sg"
  description = "Tic Tac Toe server security group"
  vpc_id      = data.aws_vpc.default.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidr
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "ttt-server-sg"
    Project = "tic-tac-toe"
  }
}

# ─── IAM Role for EC2 (SSM access) ──────────────────

resource "aws_iam_role" "ec2_role" {
  name = "ttt-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = "tic-tac-toe"
  }
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "ttt-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# ─── Secrets Module ────────────────────────────────

module "secrets" {
  source = "./modules/secrets"

  project_name = "ttt"
  environment  = "prod"
}

# ─── IAM Policy Attachments ───────────────────────

resource "aws_iam_role_policy_attachment" "ec2_ssm_secrets" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = module.secrets.secrets_policy_arn
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# ─── EC2 Instance (Free Tier) ──────────────────────

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "ttt_server" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t2.micro" # Free tier!
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.ttt_server.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  root_block_device {
    volume_size = 30 # GB, free tier allows up to 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    # Install Docker
    yum update -y
    yum install -y docker git
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ec2-user

    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  EOF

  tags = {
    Name    = "ttt-server"
    Project = "tic-tac-toe"
    Phase   = "1"
  }
}

# ─── Elastic IP (static public IP) ─────────────────

resource "aws_eip" "ttt_server" {
  instance = aws_instance.ttt_server.id
  domain   = "vpc"

  tags = {
    Name    = "ttt-server-eip"
    Project = "tic-tac-toe"
  }
}

# ─── Outputs ───────────────────────────────────────

output "server_public_ip" {
  value = aws_eip.ttt_server.public_ip
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_eip.ttt_server.public_ip}"
}
