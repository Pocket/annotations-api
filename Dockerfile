FROM node:16-bullseye-slim@sha256:dc275834dc95a991cfb8fb85dcfb29f41bcaeb3037d929153931582f77b00fb2

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
