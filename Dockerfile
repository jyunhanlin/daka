FROM node:16-alpine

ARG FEMAS_USERNAME
ARG FEMAS_PASSWORD
ARG DELAY_MIN_MINS=1
ARG DELAY_MAX_MINS=15

ENV FEMAS_USERNAME=${FEMAS_USERNAME}
ENV FEMAS_PASSWORD=${FEMAS_PASSWORD}
ENV DELAY_MIN_MINS=${DELAY_MIN_MINS}
ENV DELAY_MAX_MINS=${DELAY_MAX_MINS}

WORKDIR /app

RUN apk add --no-cache tini

COPY package.json package-lock.json ./

RUN npm install

COPY daka.js ./

RUN echo "0 2,11 * * * /usr/local/bin/node /app/daka.js" > /var/spool/cron/crontabs/root

ENTRYPOINT ["/sbin/tini", "--", "crond", "-f"]
