FROM node:18-alpine

WORKDIR /app

# Instalar Python para IA local
RUN apk add --no-cache python3 py3-pip

# Instalar dependencias Node.js
RUN npm init -y && npm install axios nodemailer xmlrpc @huggingface/transformers

# Instalar dependencias Python para IA
RUN pip3 install transformers torch ollama-python

# Crear directorio data con permisos
RUN mkdir -p /app/data && chmod 777 /app/data

# Copiar archivos
COPY config/ ./config/
COPY index.js .
COPY customer-success-dashboard.js .
COPY ai-analyzer.js .  # 🆕 Nuevo módulo de IA

# Comando de inicio
CMD ["node", "index.js"]