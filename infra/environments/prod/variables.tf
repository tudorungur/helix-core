variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aurora_min_capacity" {
  # Placeholder — revisit before actually deploying prod (not applied yet).
  type    = number
  default = 0.5
}

variable "aurora_max_capacity" {
  # Placeholder — revisit before actually deploying prod (not applied yet).
  type    = number
  default = 4
}
