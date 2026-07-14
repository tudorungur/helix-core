variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "bucket_name_prefix" {
  description = "State bucket name, suffixed with the account ID for global uniqueness."
  type        = string
  default     = "helix-core-tfstate"
}
