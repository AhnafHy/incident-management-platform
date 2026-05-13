terraform {
  backend "s3" {
    bucket = "imp-tfstate-ahnaf"
    key    = "imp/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── DYNAMODB ───────────────────────────────────────────────
resource "aws_dynamodb_table" "incidents" {
  name         = "${var.project_name}-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = { Name = "${var.project_name}-data" }
}

# ─── SQS ESCALATION QUEUE ───────────────────────────────────
resource "aws_sqs_queue" "escalation_queue" {
  name                       = "${var.project_name}-escalation"
  visibility_timeout_seconds = 120
  message_retention_seconds  = 3600
  tags = { Name = "${var.project_name}-escalation" }
}

# ─── IAM ROLE FOR LAMBDA ────────────────────────────────────
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan",
                    "dynamodb:BatchWriteItem"]
        Resource = aws_dynamodb_table.incidents.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage",
                    "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.escalation_queue.arn
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "*"
      }
    ]
  })
}

# ─── WEBSOCKET HANDLER LAMBDA ───────────────────────────────
data "archive_file" "ws_handler_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/websocket_handler.py"
  output_path = "${path.module}/../lambda/websocket_handler.zip"
}

resource "aws_lambda_function" "ws_handler" {
  filename         = data.archive_file.ws_handler_zip.output_path
  function_name    = "${var.project_name}-ws-handler"
  role             = aws_iam_role.lambda_role.arn
  handler          = "websocket_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = data.archive_file.ws_handler_zip.output_base64sha256
  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.incidents.name
    }
  }
  tags = { Name = "${var.project_name}-ws-handler" }
}

# ─── BROADCASTER LAMBDA ─────────────────────────────────────
data "archive_file" "broadcaster_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/broadcaster.py"
  output_path = "${path.module}/../lambda/broadcaster.zip"
}

resource "aws_lambda_function" "broadcaster" {
  filename         = data.archive_file.broadcaster_zip.output_path
  function_name    = "${var.project_name}-broadcaster"
  role             = aws_iam_role.lambda_role.arn
  handler          = "broadcaster.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = data.archive_file.broadcaster_zip.output_base64sha256
  environment {
    variables = {
      DYNAMODB_TABLE    = aws_dynamodb_table.incidents.name
      WEBSOCKET_ENDPOINT = "PLACEHOLDER"
    }
  }
  tags = { Name = "${var.project_name}-broadcaster" }
}

# ─── INCIDENT HANDLER LAMBDA ────────────────────────────────
data "archive_file" "incident_handler_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/incident_handler.py"
  output_path = "${path.module}/../lambda/incident_handler.zip"
}

resource "aws_lambda_function" "incident_handler" {
  filename         = data.archive_file.incident_handler_zip.output_path
  function_name    = "${var.project_name}-incident-handler"
  role             = aws_iam_role.lambda_role.arn
  handler          = "incident_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = data.archive_file.incident_handler_zip.output_base64sha256
  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.incidents.name
      ESCALATION_QUEUE_URL = aws_sqs_queue.escalation_queue.url
      BROADCASTER_FUNCTION = aws_lambda_function.broadcaster.function_name
    }
  }
  tags = { Name = "${var.project_name}-incident-handler" }
}

# ─── ESCALATION HANDLER LAMBDA ──────────────────────────────
data "archive_file" "escalation_handler_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/escalation_handler.py"
  output_path = "${path.module}/../lambda/escalation_handler.zip"
}

resource "aws_lambda_function" "escalation_handler" {
  filename         = data.archive_file.escalation_handler_zip.output_path
  function_name    = "${var.project_name}-escalation-handler"
  role             = aws_iam_role.lambda_role.arn
  handler          = "escalation_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 60
  source_code_hash = data.archive_file.escalation_handler_zip.output_base64sha256
  environment {
    variables = {
      DYNAMODB_TABLE    = aws_dynamodb_table.incidents.name
      BROADCASTER_FUNCTION = aws_lambda_function.broadcaster.function_name
    }
  }
  tags = { Name = "${var.project_name}-escalation-handler" }
}

resource "aws_lambda_event_source_mapping" "escalation_trigger" {
  event_source_arn = aws_sqs_queue.escalation_queue.arn
  function_name    = aws_lambda_function.escalation_handler.arn
  batch_size       = 1
}

# ─── INCIDENT API LAMBDA ────────────────────────────────────
data "archive_file" "api_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/incident_api.py"
  output_path = "${path.module}/../lambda/incident_api.zip"
}

resource "aws_lambda_function" "incident_api" {
  filename         = data.archive_file.api_zip.output_path
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.lambda_role.arn
  handler          = "incident_api.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = data.archive_file.api_zip.output_base64sha256
  environment {
    variables = {
      DYNAMODB_TABLE           = aws_dynamodb_table.incidents.name
      INCIDENT_HANDLER_FUNCTION = aws_lambda_function.incident_handler.function_name
      BROADCASTER_FUNCTION     = aws_lambda_function.broadcaster.function_name
    }
  }
  tags = { Name = "${var.project_name}-api" }
}

# ─── REST API GATEWAY ───────────────────────────────────────
resource "aws_api_gateway_rest_api" "api" {
  name = "${var.project_name}-api"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.incident_api.invoke_arn
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
}

resource "aws_api_gateway_deployment" "deployment" {
  depends_on  = [aws_api_gateway_integration.lambda]
  rest_api_id = aws_api_gateway_rest_api.api.id
  lifecycle { create_before_destroy = true }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.incident_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# ─── WEBSOCKET API GATEWAY ──────────────────────────────────
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "ws_integration" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ws_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_integration.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_integration.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_integration.id}"
}

resource "aws_apigatewayv2_stage" "ws_prod" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "prod"
  auto_deploy = true
}

resource "aws_lambda_permission" "ws_api_gateway" {
  statement_id  = "AllowWebSocketAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

# ─── UPDATE BROADCASTER WITH REAL WS ENDPOINT ───────────────
resource "aws_lambda_function_event_invoke_config" "broadcaster_config" {
  function_name = aws_lambda_function.broadcaster.function_name
  maximum_retry_attempts = 0
}

# Update broadcaster environment with real WebSocket endpoint
resource "null_resource" "update_broadcaster_env" {
  triggers = {
    ws_endpoint = aws_apigatewayv2_stage.ws_prod.invoke_url
  }

  provisioner "local-exec" {
    command = <<EOF
aws lambda update-function-configuration \
  --function-name ${aws_lambda_function.broadcaster.function_name} \
  --environment Variables="{DYNAMODB_TABLE=${aws_dynamodb_table.incidents.name},WEBSOCKET_ENDPOINT=${replace(aws_apigatewayv2_stage.ws_prod.invoke_url, "wss://", "https://")}}" \
  --region ${var.aws_region}
EOF
  }

  depends_on = [aws_lambda_function.broadcaster, aws_apigatewayv2_stage.ws_prod]
}

# ─── CLOUDWATCH ALARMS ──────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${var.project_name}-api-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "API Lambda error rate too high"
  dimensions = { FunctionName = aws_lambda_function.incident_api.function_name }
}