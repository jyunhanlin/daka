FROM node:18-alpine

ARG MODULE
ARG USERNAME
ARG PASSWORD
ARG DELAY_START_MINS=5
ARG DELAY_END_MINS=15
ARG IMMEDIATE_DAKA=false
ARG MAX_RETRY_COUNT=3

ENV MODULE=${MODULE}
ENV USERNAME=${USERNAME}
ENV PASSWORD=${PASSWORD}
ENV DELAY_START_MINS=${DELAY_START_MINS}
ENV DELAY_END_MINS=${DELAY_END_MINS}
ENV IMMEDIATE_DAKA=${IMMEDIATE_DAKA}
ENV MAX_RETRY_COUNT=${MAX_RETRY_COUNT}

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache tini

COPY package.json package-lock.json ./

RUN npm install

COPY src/ src/

RUN echo "0 2 * * * /usr/local/bin/node /app/src/index.js S" > /var/spool/cron/crontabs/root
RUN echo "0 11 * * * /usr/local/bin/node /app/src/index.js E" >> /var/spool/cron/crontabs/root

ENTRYPOINT ["/sbin/tini", "--", "crond", "-f"]
