FROM node:18.2.0-buster-slim

RUN mkdir -p /home/app
WORKDIR /home/app

RUN apt-get update
RUN apt-get -y install \
  .gyp \
  python3 \
  make \
  libtool \
  g++ \
  autoconf \
  automake \
  cmake \
  tzdata \
  libtool-bin \
  build-essential \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

RUN npm install -g node-pre-gyp

# COPY package.json package-lock.json ./

# RUN npm ci

CMD npm run run:dev
