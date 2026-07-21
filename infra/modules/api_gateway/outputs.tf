output "api_id" {
  value = aws_apigatewayv2_api.this.id
}

output "execution_arn" {
  value = aws_apigatewayv2_api.this.execution_arn
}

output "authorizer_id" {
  value = aws_apigatewayv2_authorizer.cognito.id
}

output "api_endpoint" {
  value = aws_apigatewayv2_stage.default.invoke_url
}
