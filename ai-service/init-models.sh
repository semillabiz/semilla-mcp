#!/bin/bash

# Iniciar Ollama en background
ollama serve &

# Esperar a que Ollama esté listo
sleep 10

# Descargar modelos necesarios
echo "Descargando modelos de IA..."
ollama pull llama2:7b
ollama pull codellama:7b

# Mantener el contenedor activo
wait