# syntax=docker/dockerfile:1.6

FROM golang:1.24.2-bookworm AS sunspot-builder
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/reilabs/sunspot.git . \
  && cd go && go build -o /sunspot .

FROM node:20-bookworm AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app/server

ENV NODE_ENV=production
ENV NARGO_HOME=/opt/nargo
ENV PATH="/opt/nargo/bin:/usr/local/bin:$PATH"
ENV GNARK_VERIFIER_BIN=/opt/sunspot/gnark-solana/crates/verifier-bin

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "$NARGO_HOME/bin" \
  && curl -L https://github.com/noir-lang/noirup/releases/latest/download/noirup -o "$NARGO_HOME/bin/noirup" \
  && chmod +x "$NARGO_HOME/bin/noirup" \
  && "$NARGO_HOME/bin/noirup" -v 1.0.0-beta.18

COPY --from=sunspot-builder /sunspot /usr/local/bin/sunspot
COPY --from=sunspot-builder /src/gnark-solana /opt/sunspot/gnark-solana

COPY --from=deps /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY server/circuit ./circuit
COPY zk /app/zk
COPY contracts/target/idl /app/contracts/target/idl

RUN cd /app/zk/noir/vote_eligibility \
  && nargo compile \
  && sunspot compile target/vote_eligibility.json \
  && sunspot setup target/vote_eligibility.ccs

EXPOSE 8080
CMD ["node", "dist/index.js"]
