#!/bin/bash

# Norte Piscinas - End-to-End Integration Test (Bash Version)
API_URL="http://localhost:3000"

echo "🚀 Starting End-to-End Integration Test (API Level)"
echo "--------------------------------------------------"

# 1. Search Product
echo "Step 1: Searching for product 'cloro'..."
PRODUCT_JSON=$(curl -s "$API_URL/products?search=cloro")
PRODUCT_ID=$(echo $PRODUCT_JSON | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
PRODUCT_NAME=$(echo $PRODUCT_JSON | grep -o '"name":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')

if [ -z "$PRODUCT_ID" ]; then
    echo "❌ Error: Could not find product."
    exit 1
fi
echo "✅ Found Product: $PRODUCT_NAME (ID: $PRODUCT_ID)"

# 2. Manage Contact
echo -e "\nStep 2: Managing contact..."
CONTACT_BODY='{
    "name": "Teste E2E Bash",
    "document": "52233830030",
    "phone": "63999999999",
    "email": "teste_bash@exemplo.com",
    "address_street": "Rua Bash",
    "address_number": "10",
    "address_zip": "77000000",
    "address_city": "Palmas",
    "address_state": "TO",
    "address_neighborhood": "Centro"
}'

CONTACT_JSON=$(curl -s -X POST -H "Content-Type: application/json" -d "$CONTACT_BODY" "$API_URL/bling/contatos")
CUSTOMER_ID=$(echo $CONTACT_JSON | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
BLING_ID=$(echo $CONTACT_JSON | grep -o '"bling_id":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')

if [ -z "$CUSTOMER_ID" ]; then
    echo "❌ Error: Could not manage contact."
    echo "Response: $CONTACT_JSON"
    exit 1
fi
echo "✅ Contact Managed: ID $CUSTOMER_ID (Bling: $BLING_ID)"

# 3. Create Order
echo -e "\nStep 3: Creating order..."
ORDER_BODY=$(printf '{"customer_id": %s, "items": [{"product_id": %s, "quantity": 1}], "payment_method": "pix_asaas"}' "$CUSTOMER_ID" "$PRODUCT_ID")

ORDER_JSON=$(curl -s -X POST -H "Content-Type: application/json" -d "$ORDER_BODY" "$API_URL/orders")
ORDER_ID=$(echo $ORDER_JSON | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
ORDER_NUMBER=$(echo $ORDER_JSON | grep -o '"order_number":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')

if [ -z "$ORDER_ID" ]; then
    echo "❌ Error: Could not create order."
    echo "Response: $ORDER_JSON"
    exit 1
fi
echo "✅ Order Created: $ORDER_NUMBER (ID: $ORDER_ID)"

# 4. Generate PIX
echo -e "\nStep 4: Generating PIX payment via Asaas..."
PIX_BODY=$(printf '{"order_id": %s}' "$ORDER_ID")

PIX_JSON=$(curl -s -X POST -H "Content-Type: application/json" -d "$PIX_BODY" "$API_URL/payments/pix")
PIX_PAYLOAD=$(echo $PIX_JSON | grep -o '"pix_copy_paste":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')

if [ -z "$PIX_PAYLOAD" ]; then
    echo "❌ Error: Could not generate PIX."
    echo "Response: $PIX_JSON"
    exit 1
fi
echo "✅ PIX Generated successfully!"
echo "PIX Payload: ${PIX_PAYLOAD:0:50}..."

echo -e "\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨"
