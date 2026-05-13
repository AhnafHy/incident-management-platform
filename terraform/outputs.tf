output "api_url" {
  value       = aws_api_gateway_stage.prod.invoke_url
  description = "REST API base URL — set as NEXT_PUBLIC_API_URL in Vercel"
}

output "websocket_url" {
  value       = aws_apigatewayv2_stage.ws_prod.invoke_url
  description = "WebSocket URL — set as NEXT_PUBLIC_WS_URL in Vercel"
}

output "escalation_queue_url" {
  value       = aws_sqs_queue.escalation_queue.url
  description = "SQS escalation queue URL"
}