# Bucket/table created by infra/bootstrap (run once, manually). Backend blocks can't reference
# variables, so the bucket name (prefix + AWS account ID) is spelled out literally here.
terraform {
  backend "s3" {
    bucket         = "helix-core-tfstate-924622219617"
    key            = "dev/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "helix-core-terraform-locks"
    encrypt        = true
  }
}
