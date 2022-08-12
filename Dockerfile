FROM node:16-alpine

ARG FEMAS_DOMAIN
ARG FEMAS_USERNAME
ARG FEMAS_PASSWORD
ARG DELAY_START_MINS=5
ARG DELAY_END_MINS=15

ENV FEMAS_DOMAIN=${FEMAS_DOMAIN}
ENV FEMAS_USERNAME=${FEMAS_USERNAME}
ENV FEMAS_PASSWORD=${FEMAS_PASSWORD}
ENV DELAY_START_MINS=${DELAY_START_MINS}
ENV DELAY_END_MINS=${DELAY_END_MINS}

WORKDIR /app

RUN apk add --no-cache tini

COPY package.json package-lock.json ./

RUN npm install

COPY daka.js ./

RUN echo "0 2,11 * * * /usr/local/bin/node /app/daka.js" > /var/spool/cron/crontabs/root

ENTRYPOINT ["/sbin/tini", "--", "crond", "-f"]
