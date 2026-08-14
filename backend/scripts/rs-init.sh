#!/bin/sh
# Inicializa el replica set rs0 de forma idempotente.
# Seguro de re-ejecutar: si ya hay config, no hace nada y sale 0.
set -u

HOST="mongodb:27017"
i=1
while [ "$i" -le 30 ]; do
  if mongosh --host "$HOST" --quiet --eval 'try { rs.status().ok } catch (e) { 0 }' 2>/dev/null | grep -q 1; then
    echo "Replica set rs0 ya inicializado"
    exit 0
  fi
  echo "Intentando inicializar replica set ($i)..."
  if mongosh --host "$HOST" --quiet --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] })' 2>/dev/null; then
    echo "Replica set rs0 inicializado"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "No se pudo inicializar el replica set" >&2
exit 1
