FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json tsconfig.eslint.json eslint.config.mjs ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/shared packages/shared

ENV NODE_ENV=production

CMD ["npm", "run", "start", "--workspace", "@the-platform/worker"]
