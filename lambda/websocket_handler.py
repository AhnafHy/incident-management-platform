import boto3
import json
import os
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', '')

def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    route_key = event.get('requestContext', {}).get('routeKey', '')
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    
    if route_key == '$connect':
        table.put_item(Item={
            'pk': f"CONN#{connection_id}",
            'sk': 'CONNECTION',
            'connection_id': connection_id,
            'connected_at': datetime.now(timezone.utc).isoformat(),
            'ttl': int(datetime.now(timezone.utc).timestamp()) + 7200  # 2 hour TTL
        })
        print(f"Client connected: {connection_id}")
        return {'statusCode': 200}
    
    elif route_key == '$disconnect':
        table.delete_item(
            Key={'pk': f"CONN#{connection_id}", 'sk': 'CONNECTION'}
        )
        print(f"Client disconnected: {connection_id}")
        return {'statusCode': 200}
    
    elif route_key == 'ping':
        return {'statusCode': 200, 'body': 'pong'}
    
    return {'statusCode': 200}