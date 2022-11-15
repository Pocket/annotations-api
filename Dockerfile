FROM node:16-bullseye-slim@sha256:dadd13efdd7c4fad88ac4f23c1da85dc74b84a30d713c2c88cd0a19bb2164c2f

WORKDIR /usr/src/app

ARG GIT_SHA

COPY . .

ENV NODE_ENV=production
ENV PORT 4242
ENV GIT_SHA=${GIT_SHA}
ENV AWS_XRAY_CONTEXT_MISSING=LOG_ERROR
ENV AWS_XRAY_LOG_LEVEL=silent

EXPOSE ${PORT}

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

CMD ["npm", "start"]
