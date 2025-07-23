#!/bin/bash
exec odoo-mcp \
  --host "$ODOO_URL" \
  --db "$ODOO_DB" \
  --user "$ODOO_USERNAME" \
  --password "$ODOO_PASSWORD" \
  --port "$ODOO_MCP_PORT" \
  --verify-ssl "${ODOO_VERIFY_SSL:-0}"