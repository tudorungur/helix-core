variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "One per AZ — at least 2 required for the Aurora DB subnet group."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}
