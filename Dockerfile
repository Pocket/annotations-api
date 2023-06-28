FROM node:18-slim@sha256:e438796c8ccc3b5117a453d0cccc039d71bf38ab3acea87f5bb0a1be17812b02

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
