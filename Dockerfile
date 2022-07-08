FROM node:16-bullseye-slim@sha256:c6d7b8fb6f41adcedaa7fd1d46fe4b4396f7c8e3b3a5b70a805d6e99bf5c3f2c

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
