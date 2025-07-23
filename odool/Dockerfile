FROM python:3.10-slim
WORKDIR /app
RUN pip install odoo-mcp mcp
COPY run_server.sh .
RUN chmod +x run_server.sh
EXPOSE ${PORT}
CMD ["./run_server.sh"]