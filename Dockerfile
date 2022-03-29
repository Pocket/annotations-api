FROM node:16-bullseye-slim@sha256:d843bf7d2e9b19bc932ad6b346ae135e86e10cdd1b93b2f549dbf774755ac5dd

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
