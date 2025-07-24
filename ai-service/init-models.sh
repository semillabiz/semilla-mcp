#!/bin/bash

# Iniciar Ollama en background
ollama serve &
OLLAMA_PID=$!

# Esperar a que Ollama esté listo
echo "Esperando a que Ollama esté listo..."
sleep 15

# Verificar si Ollama está corriendo
if ! pgrep -f "ollama serve" > /dev/null; then
    echo "Error: Ollama no se inició correctamente"
    exit 1
fi

# Descargar modelos necesarios
echo "Descargando modelos de IA..."
ollama pull llama2:7b
ollama pull codellama:7b

echo "Modelos descargados. Ollama listo para usar."

# Mantener el contenedor activo
wait $OLLAMA_PID