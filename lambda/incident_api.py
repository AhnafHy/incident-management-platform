import boto3
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
lambda_client = boto3.client('lambda')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE', '')
INCIDENT_HANDLER_FUNCTION = os.environ.get('INCIDENT_HANDLER_FUNCTION', '')
BROADCASTER_FUNCTION = os.environ.get('BROADCASTER_FUNCTION', '')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def get_all_incidents(table):
    result = table.scan(
        FilterExpression=Attr('sk').eq('METADATA') & Attr('pk').begins_with('INCIDENT#')
    )
    incidents = sorted(
        result.get('Items', []),
        key=lambda x: x.get('created_at', ''),
        reverse=True
    )
    return [{
        'incident_id': i['incident_id'],
        'title': i['title'],
        'severity': i['severity'],
        'status': i['status'],
        'service': i['service'],
        'primary_on_call': json.loads(i.get('primary_on_call', '{}')),
        'created_at': i['created_at'],
        'acknowledged_at': i.get('acknowledged_at', ''),
        'resolved_at': i.get('resolved_at', ''),
        'acknowledged_by': i.get('acknowledged_by', '')
    } for i in incidents]

def get_incident_detail(table, incident_id):
    result = table.get_item(
        Key={'pk': f"INCIDENT#{incident_id}", 'sk': 'METADATA'}
    )
    item = result.get('Item')
    if not item:
        return None
    
    return {
        'incident_id': item['incident_id'],
        'title': item['title'],
        'description': item.get('description', ''),
        'severity': item['severity'],
        'status': item['status'],
        'service': item['service'],
        'source': item.get('source', ''),
        'primary_on_call': json.loads(item.get('primary_on_call', '{}')),
        'secondary_on_call': json.loads(item.get('secondary_on_call', '{}')),
        'escalated_to': json.loads(item.get('escalated_to', 'null') or 'null'),
        'acknowledged_by': item.get('acknowledged_by', ''),
        'acknowledged_at': item.get('acknowledged_at', ''),
        'resolved_at': item.get('resolved_at', ''),
        'postmortem': item.get('postmortem', ''),
        'timeline': json.loads(item.get('timeline', '[]')),
        'created_at': item['created_at'],
        'updated_at': item['updated_at']
    }

def update_incident_status(table, incident_id, new_status, extra_data=None):
    now = datetime.now(timezone.utc).isoformat()
    
    result = table.get_item(
        Key={'pk': f"INCIDENT#{incident_id}", 'sk': 'METADATA'}
    )
    item = result.get('Item')
    if not item:
        return None
    
    timeline = json.loads(item.get('timeline', '[]'))
    
    update_expr = "SET #s = :s, updated_at = :u"
    expr_names = {'#s': 'status'}
    expr_values = {':s': new_status, ':u': now}
    
    if new_status == 'ACKNOWLEDGED':
        update_expr += ", acknowledged_at = :aa, acknowledged_by = :ab"
        expr_values[':aa'] = now
        expr_values[':ab'] = extra_data.get('acknowledged_by', 'Unknown')
        timeline.append({
            'timestamp': now,
            'event': 'ACKNOWLEDGED',
            'message': f"Acknowledged by {extra_data.get('acknowledged_by', 'Unknown')}"
        })
    
    elif new_status == 'RESOLVED':
        update_expr += ", resolved_at = :ra"
        expr_values[':ra'] = now
        timeline.append({
            'timestamp': now,
            'event': 'RESOLVED',
            'message': 'Incident resolved'
        })
    
    if extra_data and extra_data.get('postmortem'):
        update_expr += ", postmortem = :pm"
        expr_values[':pm'] = extra_data['postmortem']
        timeline.append({
            'timestamp': now,
            'event': 'POSTMORTEM_UPDATED',
            'message': 'Post-mortem updated'
        })
    
    update_expr += ", timeline = :t"
    expr_values[':t'] = json.dumps(timeline)
    
    table.update_item(
        Key={'pk': f"INCIDENT#{incident_id}", 'sk': 'METADATA'},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values
    )
    
    return get_incident_detail(table, incident_id)

def get_dashboard_stats(table):
    result = table.scan(
        FilterExpression=Attr('sk').eq('METADATA') & Attr('pk').begins_with('INCIDENT#')
    )
    incidents = result.get('Items', [])
    
    active = [i for i in incidents if i['status'] in ['TRIGGERED', 'ACKNOWLEDGED']]
    p1_active = [i for i in active if i['severity'] == 'P1']
    
    return {
        'total_incidents': len(incidents),
        'active': len(active),
        'triggered': len([i for i in incidents if i['status'] == 'TRIGGERED']),
        'acknowledged': len([i for i in incidents if i['status'] == 'ACKNOWLEDGED']),
        'resolved': len([i for i in incidents if i['status'] == 'RESOLVED']),
        'p1_active': len(p1_active),
        'recent_incidents': [{
            'incident_id': i['incident_id'],
            'title': i['title'],
            'severity': i['severity'],
            'status': i['status'],
            'service': i['service'],
            'created_at': i['created_at']
        } for i in sorted(incidents, key=lambda x: x.get('created_at', ''), reverse=True)[:5]]
    }

def get_oncall_schedule():
    schedule = [
        {'name': 'Ahnaf Hyder', 'role': 'Primary', 'email': 'ahnaf@example.com', 'timezone': 'EST'},
        {'name': 'Alex Chen', 'role': 'Secondary', 'email': 'alex@example.com', 'timezone': 'PST'},
        {'name': 'Sarah Kim', 'role': 'Tertiary', 'email': 'sarah@example.com', 'timezone': 'CST'}
    ]
    week_number = datetime.now(timezone.utc).isocalendar()[1]
    primary_index = week_number % len(schedule)
    
    return {
        'week': week_number,
        'rotation': [{
            **engineer,
            'is_current_primary': i == primary_index
        } for i, engineer in enumerate(schedule)],
        'current_primary': schedule[primary_index]
    }

def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return response(200, {})
    
    table = dynamodb.Table(TABLE_NAME)
    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    
    if method == 'GET' and path == '/health':
        return response(200, {'status': 'ok'})
    
    elif method == 'GET' and path == '/dashboard':
        return response(200, get_dashboard_stats(table))
    
    elif method == 'GET' and path == '/incidents':
        return response(200, get_all_incidents(table))
    
    elif method == 'GET' and '/incidents/' in path and path.count('/') == 2:
        incident_id = path.split('/incidents/')[-1]
        detail = get_incident_detail(table, incident_id)
        if not detail:
            return response(404, {'error': 'Incident not found'})
        return response(200, detail)
    
    elif method == 'POST' and path == '/incidents':
        body = json.loads(event.get('body', '{}'))
        result = lambda_client.invoke(
            FunctionName=INCIDENT_HANDLER_FUNCTION,
            InvocationType='RequestResponse',
            Payload=json.dumps({'body': body})
        )
        payload = json.loads(result['Payload'].read())
        return payload
    
    elif method == 'PUT' and '/incidents/' in path:
        parts = path.split('/')
        incident_id = parts[2]
        action = parts[3] if len(parts) > 3 else ''
        body = json.loads(event.get('body', '{}'))
        
        if action == 'acknowledge':
            updated = update_incident_status(table, incident_id, 'ACKNOWLEDGED', body)
            if updated:
                try:
                    lambda_client.invoke(
                        FunctionName=BROADCASTER_FUNCTION,
                        InvocationType='Event',
                        Payload=json.dumps({
                            'incident_id': incident_id,
                            'event_type': 'INCIDENT_ACKNOWLEDGED',
                            'data': {'incident_id': incident_id, 'status': 'ACKNOWLEDGED',
                                     'acknowledged_by': body.get('acknowledged_by', '')}
                        })
                    )
                except Exception as e:
                    print(f"Broadcast failed: {e}")
                return response(200, updated)
            return response(404, {'error': 'Incident not found'})
        
        elif action == 'resolve':
            updated = update_incident_status(table, incident_id, 'RESOLVED', body)
            if updated:
                try:
                    lambda_client.invoke(
                        FunctionName=BROADCASTER_FUNCTION,
                        InvocationType='Event',
                        Payload=json.dumps({
                            'incident_id': incident_id,
                            'event_type': 'INCIDENT_RESOLVED',
                            'data': {'incident_id': incident_id, 'status': 'RESOLVED'}
                        })
                    )
                except Exception as e:
                    print(f"Broadcast failed: {e}")
                return response(200, updated)
            return response(404, {'error': 'Incident not found'})
        
        elif action == 'postmortem':
            updated = update_incident_status(table, incident_id, 'RESOLVED', body)
            return response(200, updated) if updated else response(404, {'error': 'Not found'})
    
    elif method == 'GET' and path == '/oncall':
        return response(200, get_oncall_schedule())
    
    return response(404, {'error': 'Endpoint not found'})