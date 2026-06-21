FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY database ./database
COPY knexfile.ts ./knexfile.ts
COPY tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.ts && node dist/src/main.js"]

