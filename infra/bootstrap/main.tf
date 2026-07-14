# Creates the S3 bucket every environment's Terraform backend (Section 8) points at, using S3's native
# lockfile locking (Terraform >= 1.10, no DynamoDB table needed). Deliberately kept outside environments/
# and on local state: it bootstraps the very backend the other configs depend on, so it can't use that
# backend itself (chicken-and-egg). Run once per AWS account, manually (terraform init / plan / apply
# from this directory), before any environment can init.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "helix-core"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.bucket_name_prefix}-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_caller_identity" "current" {}
