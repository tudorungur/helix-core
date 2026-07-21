module "network" {
  source = "../../modules/network"

  environment = var.environment
  aws_region  = var.aws_region
}

module "database" {
  source = "../../modules/database"

  environment              = var.environment
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  lambda_security_group_id = module.network.lambda_security_group_id
  min_capacity             = var.aurora_min_capacity
  max_capacity             = var.aurora_max_capacity
  seconds_until_auto_pause = var.aurora_seconds_until_auto_pause
}

module "auth" {
  source = "../../modules/auth"

  environment = var.environment
}

module "api_gateway" {
  source = "../../modules/api_gateway"

  environment         = var.environment
  aws_region          = var.aws_region
  user_pool_id        = module.auth.user_pool_id
  user_pool_client_id = module.auth.user_pool_client_id
}

module "properties_lambda" {
  source = "../../modules/service_lambda"

  environment           = var.environment
  service_name          = "properties"
  zip_path              = "${path.module}/../../../services/properties/dist/lambda.zip"
  vpc_subnet_ids        = module.network.private_subnet_ids
  vpc_security_group_id = module.network.lambda_security_group_id
  db_secret_arn         = module.database.master_user_secret_arn
  api_id                = module.api_gateway.api_id
  api_execution_arn     = module.api_gateway.execution_arn
  authorizer_id         = module.api_gateway.authorizer_id

  environment_variables = {
    DB_PROXY_ENDPOINT = module.database.proxy_endpoint
    DB_NAME           = module.database.database_name
    DB_SECRET_ARN     = module.database.master_user_secret_arn
  }

  routes = [
    "GET /accounts/{accountId}/legal-entities",
    "POST /accounts/{accountId}/legal-entities",
    "PATCH /accounts/{accountId}/legal-entities/{id}",
    "DELETE /accounts/{accountId}/legal-entities/{id}",
    "GET /accounts/{accountId}/properties",
    "POST /accounts/{accountId}/properties",
    "PATCH /accounts/{accountId}/properties/{id}",
    "DELETE /accounts/{accountId}/properties/{id}",
    "POST /accounts/{accountId}/properties/{propertyId}/units",
    "PATCH /accounts/{accountId}/properties/{propertyId}/units/{id}",
    "DELETE /accounts/{accountId}/properties/{propertyId}/units/{id}",
  ]
}
