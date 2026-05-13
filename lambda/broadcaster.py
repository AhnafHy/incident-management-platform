import boto3
import json
import os
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', '')
WEBSOCKET_ENDPOINT = os.environ.get('WEBSOCKET_ENDPOINT', '')

def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    
    # Get all active connections
    result = table.scan(
        FilterExpression=Attr('sk').eq('CONNECTION')
    )
    connections = result.get('Items', [])
    
    if not connections:
        print("No active WebSocket connections")
        return
    
    message = json.dumps({
        'event_type': event.get('event_type'),
        'incident_id': event.get('incident_id'),
        'data': event.get('data', {}),
        'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    })
    
    # Initialize API Gateway Management client
    apigw = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=WEBSOCKET_ENDPOINT
    )
    
    stale_connections = []
    
    for conn in connections:
        connection_id = conn['connection_id']
        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=message.encode('utf-8')
            )
            print(f"Sent to {connection_id}")
        except apigw.exceptions.GoneException:
            stale_connections.append(connection_id)
        except Exception as e:
            print(f"Failed to send to {connection_id}: {e}")
    
    # Clean up stale connections
    for connection_id in stale_connections:
        table.delete_item(
            Key={'pk': f"CONN#{connection_id}", 'sk': 'CONNECTION'}
        )
        print(f"Removed stale connection: {connection_id}")