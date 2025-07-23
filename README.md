# mcp-cs-agent

Este proyecto genera un proyecto MCP-Odoo multi-cliente.

## Estructura del repositorio

```
mcp-cs-agent/
├── .env.example
├── docker-compose.yml
├── odool/
│   ├── Dockerfile
│   └── run_server.sh
├── agent/
│   ├── Dockerfile
│   └── config/
│       └── agent_config.json
└── README.md
```

## 1. .env.example

Archivo base con variables comunes:

```
# Macro-configuración multi-cliente: define múltiples instancias separadas
ODOO1_URL=`https://cliente1.odoo.com`
ODOO1_DB=bd_cliente1
ODOO1_USER=usuario1
ODOO1_PASS=pass1

ODOO2_URL=`https://cliente2.odoo.com`
ODOO2_DB=bd_cliente2
ODOO2_USER=usuario2
ODOO2_PASS=pass2

# Puerto base
SERVER_PORT=8090
```

## 2. docker-compose.yml

Define los servicios MCP para múltiples instancias:

```yaml
version: '3.8'
services:
  odoo1:
    build: ./odool
    container_name: mcp_odoo1
    env_file: .env
    environment:
      - ODOO_URL=${ODOO1_URL}
      - ODOO_DB=${ODOO1_DB}
      - ODOO_USERNAME=${ODOO1_USER}
      - ODOO_PASSWORD=${ODOO1_PASS}
      - PORT=8091
    ports:
      - "8091:8091"

  odoo2:
    build: ./odool
    container_name: mcp_odoo2
    env_file: .env
    environment:
      - ODOO_URL=${ODOO2_URL}
      - ODOO_DB=${ODOO2_DB}
      - ODOO_USERNAME=${ODOO2_USER}
      - ODOO_PASSWORD=${ODOO2_PASS}
      - PORT=8092
    ports:
      - "8092:8092"

  agent:
    build: ./agent
    container_name: cs_agent
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - odoo1
      - odoo2
```

## 3. Carpeta odool/

### Dockerfile

```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN pip install odoo-mcp
COPY run_server.sh .
RUN chmod +x run_server.sh
EXPOSE ${PORT}
CMD ["./run_server.sh"]
```

### run_server.sh

```bash
#!/bin/bash
exec odoo-mcp \
  --host "$ODOO_URL" \
  --db "$ODOO_DB" \
  --user "$ODOO_USERNAME" \
  --password "$ODOO_PASSWORD" \
  --port "$PORT"
```

Este script lanza el servidor MCP para cada cliente en puertos 8091 y 8092.

## 4. Carpeta agent/ (Cliente IA)

Aquí puedes definir un agente simple que se conecte a ambos MCP.

### Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /agent
COPY config/agent_config.json .
COPY . .
RUN npm install
CMD ["node", "index.js"]
```

### config/agent_config.json

```json
{
  "mcpServers": {
    "cliente1": { "url": "http://odoo1:8091" },
    "cliente2": { "url": "http://odoo2:8092" }
  },
  "autoRun": {
    "workflow": [
      {
        "name": "monitor_usage",
        "cron": "0 9 * * MON",
        "prompt": "Chequea logins y uso para {{cliente}} y genera alerta si <5 usuarios activos"
      }
    ]
  }
}
```

### index.js

```javascript
import { Agent } from 'modelcontextprotocol-agent';
import config from './config/agent_config.json';

async function main() {
  const agent = new Agent(config.mcpServers);
  await agent.start();

  for await (const event of agent.events()) {
    if (event.type === 'workflow') {
      const resp = await agent.runPrompt(event.prompt.replace('{{cliente}}', event.name));
      console.log(`[${event.name}]`, resp);
    }
  }
}

main();
```

## 5. Instrucciones para tu copiloto:

1. Copiar <mcfile name=".env.example" path=".env.example"></mcfile> como <mcfile name=".env" path=".env"></mcfile> y rellenar credenciales Odoo.
2. Ejecutar `docker-compose up --build`.
3. Validar que los servidores MCP estén disponibles en puertos 8091 y 8092.
4. Revisar logs del agente (`cs_agent`) para ver salidas automáticas de workflow.

## 6. Cómo funciona

* Cada instancia `odoo1`, `odoo2` inicia un servidor MCP en 8091, 8092.
* El agente lee la configuración y se conecta automáticamente.
* Workflow diario: chequea uso e indica alerta si mal uso.
* Puedes ampliar workflows o prompts para satisfacción o tickets.

## 7. Referencias

* `tuanle96/mcp-odoo` usa XML-RPC y expone modelos, búsqueda, ejecución de métodos…
* Configuración flexible con <mcfile name=".env" path=".env"></mcfile>, múltiples contenedores y puertos adaptados.
* Agente usa SDK MCP para conectarse y lanzar prompts automáticamente.