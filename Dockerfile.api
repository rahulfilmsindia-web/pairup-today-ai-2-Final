FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .npmrc* ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build && npm run build:admin && npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js && npx esbuild server/jobs/maintenance.ts --bundle --platform=node --format=esm --packages=external --outfile=maintenance-job.js

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/package*.json ./
COPY --from=build /app/.npmrc* ./
RUN npm ci --omit=dev --legacy-peer-deps
RUN mkdir -p /app/data && chown -R node:node /app
COPY --from=build --chown=node:node /app/server.js ./server.js
COPY --from=build --chown=node:node /app/maintenance-job.js ./maintenance-job.js
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-admin ./dist-admin
USER node
EXPOSE 8080
CMD ["npm", "run", "start:prod"]
