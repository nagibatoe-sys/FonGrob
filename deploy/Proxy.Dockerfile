FROM caddy:2-alpine
COPY --chmod=644 Caddyfile /etc/caddy/Caddyfile
