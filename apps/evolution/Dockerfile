FROM atendai/evolution-api:v2.2.3

WORKDIR /evolution

# Atualiza o Baileys no local exato onde a Evolution API o carrega
RUN npm install baileys@6.7.21 --legacy-peer-deps --no-audit \
    && npm install @whiskeysockets/baileys@6.7.21 --legacy-peer-deps --no-audit \
    && node -e "const p=require('./node_modules/baileys/package.json'); console.log('Baileys updated to:', p.version)"

EXPOSE 8080
