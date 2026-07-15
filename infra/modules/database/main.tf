# Aurora PostgreSQL Serverless v2 + RDS Proxy (Section 2/Section 6). Lambda never talks to Aurora
# directly — only through the Proxy, hence the two-hop security group chain below.

resource "aws_db_subnet_group" "this" {
  name       = "helix-${var.environment}-db"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "helix-${var.environment}-db-subnet-group"
  }
}

resource "aws_security_group" "rds_proxy" {
  name_prefix = "helix-${var.environment}-rds-proxy-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "helix-${var.environment}-rds-proxy-sg"
  }
}

resource "aws_security_group" "aurora" {
  name_prefix = "helix-${var.environment}-aurora-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds_proxy.id]
  }

  tags = {
    Name = "helix-${var.environment}-aurora-sg"
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "helix-${var.environment}"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version
  database_name      = var.db_name
  master_username    = var.master_username
  # RDS-managed master password, stored/rotated in Secrets Manager automatically — no secret
  # material ever lives in Terraform state or this repo.
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.this.name
  vpc_security_group_ids      = [aws_security_group.aurora.id]
  storage_encrypted           = true
  skip_final_snapshot         = var.environment != "prod"

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}

resource "aws_rds_cluster_instance" "this" {
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
}

resource "aws_iam_role" "rds_proxy" {
  name = "helix-${var.environment}-rds-proxy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name = "secrets-access"
  role = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_rds_cluster.this.master_user_secret[0].secret_arn]
    }]
  })
}

resource "aws_db_proxy" "this" {
  name                   = "helix-${var.environment}"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]

  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_rds_cluster.this.master_user_secret[0].secret_arn
  }
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    max_connections_percent = 100
  }
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name         = aws_db_proxy.this.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
  db_cluster_identifier = aws_rds_cluster.this.cluster_identifier
}
