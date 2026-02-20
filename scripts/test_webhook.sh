#!/bin/bash
# Test AI Router Webhook
curl -X POST "http://localhost:5678/webhook/ai-tutor-v2-unique-rafael" 
     -H "Content-Type: application/json" 
     -d '{"phone": "556399374165", "body": "Teste de conexão"}'
