FROM node:16-bullseye-slim@sha256:7d95bfe09e2244aa56ce7d836ac6f45ed6df2e2c270e1c087033d9acab83f660

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
