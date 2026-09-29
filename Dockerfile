FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/runtime-config.template.json /opt/runtime-config.template.json
COPY docker/entrypoint.sh /entrypoint.sh
COPY --from=build /app/dist/dmc-dataloader-console/browser /usr/share/nginx/html
RUN chmod +x /entrypoint.sh
ENV PORT=8080
ENV API_BASE_URL=""
ENV USE_MOCK=false
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
