# Angular 22 requires Node ^22.22.3, ^24.15.0 or >=26.0.0.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS final
ENV PORT=80
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/pere/browser /usr/share/nginx/html
EXPOSE 80
