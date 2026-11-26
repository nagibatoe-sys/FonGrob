FROM postgres:17-alpine
COPY --chmod=755 init-db.sh /docker-entrypoint-initdb.d/10-fongrob.sh
