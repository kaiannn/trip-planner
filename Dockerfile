FROM node:18-alpine AS build

WORKDIR /app

# Install root deps
COPY package.json package-lock.json ./
RUN npm ci

# Install client deps
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

# Copy source
COPY . .

# Build client (VITE_AMAP_KEY injected at build time)
ARG VITE_AMAP_KEY=""
RUN npm run build --prefix client

# ── Production ──
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY server/ ./server/
COPY --from=build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
