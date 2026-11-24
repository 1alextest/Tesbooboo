FROM node:22-bookworm-slim AS builder
WORKDIR /build

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm ls multer proxy-addr body-parser --omit=dev --all \
    && node -e "const fs=require('fs'); for(const p of ['node_modules/multer/package.json','node_modules/@nestjs/platform-express/node_modules/multer/package.json']) { if(!fs.existsSync(p)) continue; const [major,minor]=require('./'+p).version.split('.').map(Number); if(major!==2 || minor<5) process.exit(1) }"

# OCR data is an integrity-checked, locked build dependency, not an extra install
# that re-resolves the production graph. No npm install/update follows npm ci.
COPY --from=builder /build/node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz /app/tessdata/eng.traineddata.gz

# Runtime does not execute npm; remove the CLI and its bundled vulnerable tools
# after installing the OCR data. OS security patches remain part of the scan.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder /build/dist ./dist
COPY migrations ./migrations

RUN mkdir -p /app/uploads && groupadd -r app && useradd -r -g app app && chown -R app:app /app
USER app

EXPOSE 7000
CMD ["node", "dist/main.js"]
