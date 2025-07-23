FROM node:18-alpine

WORKDIR /app

# Instalar dependencias
RUN npm init -y && npm install axios nodemailer xmlrpc

# Copiar archivos
COPY config/ ./config/
COPY index.js .

# Comando de inicio
CMD ["node", "index.js"]