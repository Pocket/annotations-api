FROM node:16-bullseye-slim@sha256:a7311af89d7596d2137cbb1345c3172a1234ea5fc9eda4b1a29281a0f301f2a7

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
