FROM node:18-slim@sha256:2ff9841de879f1a2d2d8ef83183c2d93435c451a36d6cfb37b3331d1386c00f8

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
