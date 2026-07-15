# VPC + private subnets for Aurora + Lambda ENIs (Section 8). No NAT Gateway / Internet Gateway yet —
# deferred until Phase 2/3 (ANAF live submission, Netopia payments) actually need Lambda to reach the
# public internet. Until then, Lambda-in-VPC still needs a way to reach AWS APIs for logging and DB
# secrets, which VPC endpoints provide without any internet route.

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "helix-${var.environment}-vpc"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "helix-${var.environment}-private-${count.index}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "helix-${var.environment}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Shared by every Lambda function running in the VPC (Section 6).
resource "aws_security_group" "lambda" {
  name_prefix = "helix-${var.environment}-lambda-"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "helix-${var.environment}-lambda-sg"
  }
}

resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "helix-${var.environment}-vpce-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = {
    Name = "helix-${var.environment}-vpce-sg"
  }
}

# Free (no hourly charge) — S3 access (meter-photos, invoices-pdf, ticket-photos, deposit-photos).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
}

# Interface endpoints (small hourly cost each, still far cheaper than a NAT Gateway) — the minimum
# Lambda-in-VPC needs to function at all: CloudWatch Logs and Secrets Manager (RDS Proxy credentials).
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}
