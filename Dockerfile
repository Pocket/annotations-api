FROM node:16-bullseye-slim@sha256:c80e2b76fb0fd5417a1d7a9c315d42e795412d2835f7fe91bbaaa91f4ee0a007

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
