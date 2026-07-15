output "proxy_endpoint" {
  value = aws_db_proxy.this.endpoint
}

output "master_user_secret_arn" {
  value = aws_rds_cluster.this.master_user_secret[0].secret_arn
}

output "database_name" {
  value = var.db_name
}

output "aurora_security_group_id" {
  value = aws_security_group.aurora.id
}
