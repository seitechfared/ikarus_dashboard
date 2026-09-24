FROM node:20-alpine AS build

WORKDIR /app

# Add build args
ARG VITE_IKARUS_API_BASE_URL=/api
ARG VITE_GOOGLE_MAPS_API_KEY

# Set as env vars for build
ENV VITE_IKARUS_API_BASE_URL=$VITE_IKARUS_API_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S ikarus-appuser && \
    adduser -u 1001 -S ikarus-appuser -G ikarus-appuser && \
    chown -R ikarus-appuser:ikarus-appuser /app

RUN npm install -g serve && \
    chown -R ikarus-appuser:ikarus-appuser /usr/local/lib/node_modules

COPY --from=build --chown=ikarus-appuser:ikarus-appuser /app/dist /app/dist

USER ikarus-appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

EXPOSE 5173

CMD ["serve", "-s", "/app/dist", "-l", "5173"]