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

  default_tags {
    tags = {
      Project     = "helix-core"
      Environment = var.environment
    }
  }
}
