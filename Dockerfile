FROM node:16-bullseye-slim@sha256:f00e66f4e3d5f3cf1322049440f9d84c79462cf2157f6d9bac26cec8d31f950e

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
