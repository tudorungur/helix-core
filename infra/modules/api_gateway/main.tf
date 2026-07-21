# One shared HTTP API + Cognito JWT authorizer per environment (Section 6's diagram — a single
# "APIGW" node in front of every bounded-context Lambda). Each service's own
# `module.service_lambda` instantiation attaches its routes to this one API rather than standing up
# its own gateway.

resource "aws_apigatewayv2_api" "this" {
  name          = "helix-${var.environment}"
  protocol_type = "HTTP"
}

# Section 3.2, step 1 — verifies the Cognito-issued JWT and exposes its claims (sub, etc.) to every
# Lambda behind an authorized route via event.requestContext.authorizer.jwt.claims. Permission
# resolution itself (step 2-4: membership role, scopes) happens in each Lambda, not here — API
# Gateway only proves *who* the caller is, not what they're allowed to do.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "helix-${var.environment}-cognito"

  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.user_pool_id}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}
