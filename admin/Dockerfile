ARG NODE_BASE_IMAGE=node:20-alpine
ARG NGINX_BASE_IMAGE=nginx:stable-alpine

FROM ${NODE_BASE_IMAGE} AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set API URL to empty string (relative path)
ENV VITE_API_URL=

RUN npm run build

# Production stage
FROM ${NGINX_BASE_IMAGE} AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
