FROM node:16-bullseye-slim@sha256:5131ea6fc404c20d7d6e2b2c48b0c917129f6550250f67c5c5fb0c3fd3ee8b08

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
