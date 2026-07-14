# Creates the S3 bucket every environment's Terraform backend (Section 8) points at, using S3's native
# lockfile locking (Terraform >= 1.10, no DynamoDB table needed). Deliberately kept outside environments/:
# it bootstraps the very backend the other configs (and, after the first apply, this config too) depend
# on. The very first `terraform init` here has no backend block yet and runs on local state — there's no
# bucket for it to point at until after the first `apply`. Immediately after that, the backend block below
# is added/uncommented and `terraform init -migrate-state` moves this config's own state into the bucket
# it just created, under its own key — so a fresh clone only ever needs this repo + AWS credentials, no
# local state file to lose.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket       = "helix-core-tfstate-924622219617"
    key          = "bootstrap/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
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
