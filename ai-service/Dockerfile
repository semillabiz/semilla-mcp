FROM ollama/ollama:latest

# Crear directorio para modelos
RUN mkdir -p /root/.ollama

# Exponer puerto
EXPOSE 11434

# Script de inicialización
COPY init-models.sh /init-models.sh
RUN chmod +x /init-models.sh

CMD ["/init-models.sh"]