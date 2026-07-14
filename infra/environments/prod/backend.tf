# Bucket created by infra/bootstrap (run once, manually). Backend blocks can't reference variables,
# so the bucket name (prefix + AWS account ID) is spelled out literally here. Locking uses S3's native
# lockfile (Terraform >= 1.10) — no DynamoDB table.
terraform {
  backend "s3" {
    bucket       = "helix-core-tfstate-924622219617"
    key          = "prod/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
