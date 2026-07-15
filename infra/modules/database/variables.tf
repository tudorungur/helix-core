variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "lambda_security_group_id" {
  description = "Lambda functions reach Aurora only through RDS Proxy, never directly."
  type        = string
}

variable "db_name" {
  type    = string
  default = "helix"
}

variable "master_username" {
  type    = string
  default = "helix_admin"
}

variable "engine_version" {
  description = "Aurora PostgreSQL version — confirmed available in eu-west-1 and supports serverless v2 (engine mode \"provisioned\")."
  type        = string
  default     = "17.9"
}

variable "min_capacity" {
  description = "Minimum Aurora Serverless v2 ACUs."
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum Aurora Serverless v2 ACUs."
  type        = number
  default     = 2
}
