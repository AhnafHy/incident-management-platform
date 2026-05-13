import boto3
import json
import os
import uuid
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
lambda_client = boto3.client('lambda')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE', '')
ESCALATION_QUEUE_URL = os.environ.get('ESCALATION_QUEUE_URL', '')
BROADCASTER_FUNCTION = os.environ.get('BROADCASTER_FUNCTION', '')

# Escalation delay by severity in seconds
ESCALATION_DELAYS = {
    'P1': 300,   # 5 minutes
    'P2': 600,   # 10 minutes
    'P3': 0      # No escalation for P3
}

ON_CALL_SCHEDULE = [
    {'name': 'Ahnaf Hyder', 'role': 'Primary', 'email': 'ahnaf@example.com'},
    {'name': 'Alex Chen', 'role': 'Secondary', 'email': 'alex@example.com'},
    {'name': 'Sarah Kim', 'role': 'Tertiary', 'email': 'sarah@example.com'}
]

def get_on_call_engineer(rotation_offset=0):
    week_number = datetime.now(timezone.utc).isocalendar()[1]
    index = (week_number + rotation_offset) % len(ON_CALL_SCHEDULE)
    return ON_CALL_SCHEDULE[index]

def create_incident(table, incident_data):
    incident_id = str(uuid.uuid4())[:8].upper()
    now = datetime.now(timezone.utc).isoformat()
    severity = incident_data.get('severity', 'P2')
    
    primary = get_on_call_engineer(0)
    secondary = get_on_call_engineer(1)
    
    incident = {
        'pk': f"INCIDENT#{incident_id}",
        'sk': 'METADATA',
        'incident_id': incident_id,
        'title': incident_data.get('title', 'Untitled Incident'),
        'description': incident_data.get('description', ''),
        'severity': severity,
        'status': 'TRIGGERED',
        'source': incident_data.get('source', 'manual'),
        'service': incident_data.get('service', 'Unknown'),
        'primary_on_call': json.dumps(primary),
        'secondary_on_call': json.dumps(secondary),
        'created_at': now,
        'updated_at': now,
        'acknowledged_at': '',
        'resolved_at': '',
        'acknowledged_by': '',
        'timeline': json.dumps([{
            'timestamp': now,
            'event': 'TRIGGERED',
            'message': f"Incident triggered — {primary['name']} paged as primary on-call"
        }])
    }
    
    table.put_item(Item=incident)
    return incident_id, incident

def schedule_escalation(incident_id, severity, delay_seconds):
    if severity == 'P3' or delay_seconds == 0:
        return
    
    sqs.send_message(
        QueueUrl=ESCALATION_QUEUE_URL,
        MessageBody=json.dumps({
            'incident_id': incident_id,
            'escalation_level': 1,
            'severity': severity
        }),
        DelaySeconds=min(delay_seconds, 900)  # SQS max delay is 900s
    )

def broadcast_incident(incident_id, event_type, data):
    try:
        lambda_client.invoke(
            FunctionName=BROADCASTER_FUNCTION,
            InvocationType='Event',
            Payload=json.dumps({
                'incident_id': incident_id,
                'event_type': event_type,
                'data': data
            })
        )
    except Exception as e:
        print(f"Broadcast failed: {e}")

def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    
    # Handle both direct invocation and API Gateway
    if isinstance(event.get('body'), str):
        body = json.loads(event['body'])
    else:
        body = event.get('body', event)
    
    action = body.get('action', 'create')
    
    if action == 'create':
        incident_id, incident = create_incident(table, body)
        severity = incident['severity']
        delay = ESCALATION_DELAYS.get(severity, 0)
        
        if delay > 0:
            schedule_escalation(incident_id, severity, delay)
        
        # Broadcast to all WebSocket connections
        broadcast_data = {
            'incident_id': incident_id,
            'title': incident['title'],
            'severity': severity,
            'status': 'TRIGGERED',
            'service': incident['service'],
            'primary_on_call': json.loads(incident['primary_on_call']),
            'created_at': incident['created_at']
        }
        broadcast_incident(incident_id, 'INCIDENT_CREATED', broadcast_data)
        
        return {
            'statusCode': 201,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'incident_id': incident_id,
                'severity': severity,
                'status': 'TRIGGERED',
                'primary_on_call': json.loads(incident['primary_on_call'])
            })
        }
    
    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'Unknown action'})
    }