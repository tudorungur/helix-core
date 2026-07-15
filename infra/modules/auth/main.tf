# Cognito User Pool (Section 2/Section 3) — one per environment, global identity, no roles stored here
# (roles/scope live in Postgres, per the account_memberships/tenancy_memberships model).

resource "aws_cognito_user_pool" "this" {
  name = "helix-${var.environment}"

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  tags = {
    Name = "helix-${var.environment}-user-pool"
  }
}

# Public client for the Expo app (Section 5) — no secret, SRP-based sign-in, no OAuth hosted UI.
resource "aws_cognito_user_pool_client" "mobile" {
  name         = "helix-${var.environment}-mobile"
  user_pool_id = aws_cognito_user_pool.this.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
}
