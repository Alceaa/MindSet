# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG REACT_APP_BASE_API_URL=""
ENV REACT_APP_BASE_API_URL=$REACT_APP_BASE_API_URL

ARG PUBLIC_URL=""
ENV PUBLIC_URL=$PUBLIC_URL

ENV CI=true
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=1024

RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
