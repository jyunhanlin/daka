FROM node:16-alpine

WORKDIR /app

ARG FEMAS_USERNAME
ARG FEMAS_PASSWORD
ARG DELAY_MIN_MINS=1
ARG DELAY_MAX_MINS=15

ENV FEMAS_USERNAME=${FEMAS_USERNAME}
ENV FEMAS_PASSWORD=${FEMAS_PASSWORD}
ENV DELAY_MIN_MINS=${DELAY_MIN_MINS}
ENV DELAY_MAX_MINS=${DELAY_MAX_MINS}

COPY package.json package-lock.json ./

RUN npm install

COPY daka.js ./

RUN echo "0 2,11 * * * /usr/local/bin/node daka.js >>daka.log 2>&1" >> /var/spool/cron/crontabs/root

CMD crond -f
