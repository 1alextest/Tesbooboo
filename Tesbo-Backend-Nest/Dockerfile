FROM node:22-bookworm-slim AS builder
WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Refresh semver-compatible production transitive dependencies before the image is
# scanned. This includes security patches for Nest's nested Multer and proxy-addr.
# Trivy remains a blocking gate on the final runtime image.
# The NestJS 10 transitive Multer copy otherwise stays on vulnerable 2.0.x.
# Constrain it to the already-supported direct Multer 2.x range, not NestJS 12.
RUN npm pkg set 'overrides.multer=$multer' \
    && npm install --omit=dev --no-audit --no-fund \
    && npm ls multer proxy-addr --omit=dev --all \
    && node -e "const fs=require('fs'); for(const p of ['node_modules/multer/package.json','node_modules/@nestjs/platform-express/node_modules/multer/package.json']) { if(!fs.existsSync(p)) continue; const [major,minor]=require('./'+p).version.split('.').map(Number); if(major!==2 || minor<3) process.exit(1) }"


# Bake the English OCR language data into the image at build time (from the npm registry,
# the same trust boundary as the rest of the dependency tree) so image-to-text extraction
# in the knowledge base works fully offline — no CDN call at request time.
RUN npm install --no-save @tesseract.js-data/eng@1.0.0 \
    && mkdir -p /app/tessdata \
    && cp node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz /app/tessdata/eng.traineddata.gz \
    && rm -rf node_modules/@tesseract.js-data

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
