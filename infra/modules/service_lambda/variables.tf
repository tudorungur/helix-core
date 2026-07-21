variable "environment" {
  type = string
}

# One instantiation of this module = one Lambda + its routes on the shared HTTP API (Section 6 —
# "one function per bounded context"). `service_name` becomes the Lambda function name and log
# group; `routes` are HTTP API route keys ("METHOD /path/{param}") all proxied to that one function,
# matching how the function's own src/index.ts does its own internal routing.
variable "service_name" {
  type = string
}

variable "zip_path" {
  description = "Path to the bundled Lambda deployment package (see the service's `package` script)."
  type        = string
}

variable "handler" {
  type    = string
  default = "bundle.handler"
}

variable "routes" {
  type = list(string)
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "timeout" {
  type    = number
  default = 10
}

variable "memory_size" {
  type    = number
  default = 256
}

variable "vpc_subnet_ids" {
  type = list(string)
}

variable "vpc_security_group_id" {
  type = string
}

variable "db_secret_arn" {
  description = "Lambda needs to read this to open its own Drizzle connection through RDS Proxy (Section 7.2)."
  type        = string
}

variable "api_id" {
  type = string
}

variable "api_execution_arn" {
  type = string
}

variable "authorizer_id" {
  type = string
}
