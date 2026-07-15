output "vpc_id" {
  value = module.network.vpc_id
}

output "db_proxy_endpoint" {
  value = module.database.proxy_endpoint
}

output "db_master_user_secret_arn" {
  value = module.database.master_user_secret_arn
}

output "cognito_user_pool_id" {
  value = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  value = module.auth.user_pool_client_id
}
