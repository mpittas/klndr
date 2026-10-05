# syntax=docker/dockerfile:1

# The API as a container, for Cloud Run (see docs/mobile-port/HUMAN_TODO.md, "where apps/api runs").
#
# `apps/api` is a Hono app — `createApp(config)` returns a fetch handler — run on plain Node through
# `tsx` (`src/server.ts`). It compiles `@klndr/core` from source over the npm workspace link, so the
# image needs the workspace root plus `packages/core` and `apps/api`; neither front end belongs in it.
#
# Build from the repository root, so the workspace manifests are all in place:
#   docker build -f apps/api/Dockerfile -t klndr-api .

# --- dependencies ------------------------------------------------------------------------------
# `npm ci` validates the lockfile against *every* workspace manifest, so all of them must be copied
# even though only two are installed from.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web-react/package.json apps/web-react/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/tokens/package.json packages/tokens/
RUN npm ci

# --- runtime -----------------------------------------------------------------------------------
# One stage: `tsx` is a devDependency and is what runs the server, so there is no pruned tree to
# copy into a slimmer image. The sources are small; the dependencies are the image.
FROM deps AS runtime
ENV NODE_ENV=production
# Cloud Run injects $PORT (8080 by default); 0.0.0.0 is what @hono/node-server binds.
ENV PORT=8080
EXPOSE 8080

COPY packages/core packages/core
COPY apps/api apps/api

# With NODE_ENV=production the app is fail-closed: without FIREBASE_PROJECT_ID it exits instead of
# serving with the local-dev user. Set it on the service, e.g.
#   --set-env-vars FIREBASE_PROJECT_ID=klndr-app
CMD ["npm", "start", "-w", "apps/api"]
