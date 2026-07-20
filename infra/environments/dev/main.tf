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
