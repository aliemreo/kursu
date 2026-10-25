# Aşama 1: Vite ile statik dosyaları üret.
FROM node:22-alpine AS build
WORKDIR /app

# Vite, VITE_ değişkenlerini build anında koda gömer. Bu yüzden ARG olarak alınır.
ARG VITE_API_BASE_URL=/api
ARG VITE_USE_MOCKS=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_USE_MOCKS=$VITE_USE_MOCKS

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Aşama 2: Derlenmiş dosyaları Nginx ile sun.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]