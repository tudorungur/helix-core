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

variable "seconds_until_auto_pause" {
  description = "Idle time before the cluster auto-pauses to 0 ACU (only takes effect when min_capacity = 0). Null disables auto-pause."
  type        = number
  default     = null
}

variable "enable_data_api" {
  description = "Enables the RDS Data API (HTTPS/IAM SQL execution) — the only way to reach this cluster from outside the VPC without a bastion or NAT."
  type        = bool
  default     = true
}
