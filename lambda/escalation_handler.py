import boto3
import json
import os
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
lambda_client = boto3.client('lambda')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE', '')
BROADCASTER_FUNCTION = os.environ.get('BROADCASTER_FUNCTION', '')

ON_CALL_SCHEDULE = [
    {'name': 'Ahnaf Hyder', 'role': 'Primary', 'email': 'ahnaf@example.com'},
    {'name': 'Alex Chen', 'role': 'Secondary', 'email': 'alex@example.com'},
    {'name': 'Sarah Kim', 'role': 'Tertiary', 'email': 'sarah@example.com'}
]

def get_on_call_engineer(rotation_offset=0):
    week_number = datetime.now(timezone.utc).isocalendar()[1]
    index = (week_number + rotation_offset) % len(ON_CALL_SCHEDULE)
    return ON_CALL_SCHEDULE[index]

def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    
    for record in event.get('Records', []):
        body = json.loads(record['body'])
        incident_id = body['incident_id']
        escalation_level = body.get('escalation_level', 1)
        
        # Check if incident is still unacknowledged
        result = table.get_item(
            Key={'pk': f"INCIDENT#{incident_id}", 'sk': 'METADATA'}
        )
        incident = result.get('Item')
        
        if not incident:
            print(f"Incident {incident_id} not found")
            continue
        
        if incident['status'] != 'TRIGGERED':
            print(f"Incident {incident_id} already {incident['status']} — skipping escalation")
            continue
        
        # Escalate to next on-call engineer
        escalated_to = get_on_call_engineer(escalation_level)
        now = datetime.now(timezone.utc).isoformat()
        
        timeline = json.loads(incident.get('timeline', '[]'))
        timeline.append({
            'timestamp': now,
            'event': 'ESCALATED',
            'message': f"No acknowledgment — escalated to {escalated_to['name']} ({escalated_to['role']})"
        })
        
        table.update_item(
            Key={'pk': f"INCIDENT#{incident_id}", 'sk': 'METADATA'},
            UpdateExpression="SET escalated_to = :e, timeline = :t, updated_at = :u",
            ExpressionAttributeValues={
                ':e': json.dumps(escalated_to),
                ':t': json.dumps(timeline),
                ':u': now
            }
        )
        
        # Broadcast escalation
        try:
            lambda_client.invoke(
                FunctionName=BROADCASTER_FUNCTION,
                InvocationType='Event',
                Payload=json.dumps({
                    'incident_id': incident_id,
                    'event_type': 'INCIDENT_ESCALATED',
                    'data': {
                        'incident_id': incident_id,
                        'escalated_to': escalated_to,
                        'escalation_level': escalation_level
                    }
                })
            )
        except Exception as e:
            print(f"Broadcast failed: {e}")
        
        print(f"Incident {incident_id} escalated to {escalated_to['name']}")