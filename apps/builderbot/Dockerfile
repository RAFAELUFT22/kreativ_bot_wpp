# =============================================================================
# BuilderBot — Multi-stage build
# Stage 1: Compila TypeScript
# Stage 2: Imagem de produção mínima
# =============================================================================

FROM node:21-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# -----------------------------------------------------------------------------

FROM node:21-alpine AS runner

WORKDIR /app

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copia build gerado pelo stage anterior
COPY --from=builder /app/dist ./dist

EXPOSE 3008

CMD ["node", "dist/app.js"]
