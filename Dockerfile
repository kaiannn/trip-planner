FROM node:20-alpine AS build

WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY client/ ./client/

ARG VITE_AMAP_KEY=""
ARG VITE_BASE_PATH="/"
RUN npm run build --prefix client

# ── Production: nginx ──
FROM nginx:alpine

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
