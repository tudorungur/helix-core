resource "aws_iam_role" "lambda" {
  name = "helix-${var.environment}-${var.service_name}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ENI management for VPC access (Aurora reachability, Section 6) + CloudWatch Logs — the standard
# AWS-managed policy for any Lambda running inside a VPC.
resource "aws_iam_role_policy_attachment" "vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "db_secret" {
  name = "db-secret-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.db_secret_arn]
    }]
  })
}

resource "aws_lambda_function" "this" {
  function_name = "helix-${var.environment}-${var.service_name}"
  role          = aws_iam_role.lambda.arn
  handler       = var.handler
  runtime       = "nodejs22.x"
  timeout       = var.timeout
  memory_size   = var.memory_size

  filename         = var.zip_path
  source_code_hash = filebase64sha256(var.zip_path)

  vpc_config {
    subnet_ids         = var.vpc_subnet_ids
    security_group_ids = [var.vpc_security_group_id]
  }

  environment {
    variables = var.environment_variables
  }
}

resource "aws_apigatewayv2_integration" "this" {
  api_id                 = var.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "this" {
  for_each = toset(var.routes)

  api_id             = var.api_id
  route_key          = each.value
  target             = "integrations/${aws_apigatewayv2_integration.this.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
