# Frontend Dockerfile for Local AI Beast (Next.js)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
RUN npm install --production --legacy-peer-deps

EXPOSE 3000
CMD ["npm", "start"]

