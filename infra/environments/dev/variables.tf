variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aurora_min_capacity" {
  type    = number
  default = 0
}

variable "aurora_max_capacity" {
  type    = number
  default = 2
}

variable "aurora_seconds_until_auto_pause" {
  description = "Idle time before Aurora auto-pauses to 0 ACU — dev only, keeps this a non-issue to leave running."
  type        = number
  default     = 3600 # 1 hour
}
