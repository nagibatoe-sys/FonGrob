FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG SUPABASE_AUTH_URL
ARG SUPABASE_REST_URL
ENV SUPABASE_AUTH_URL=$SUPABASE_AUTH_URL
ENV SUPABASE_REST_URL=$SUPABASE_REST_URL
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; npm ci
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/next.config.mjs ./
USER node
EXPOSE 3000
CMD ["npm","start"]
