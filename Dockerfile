# Utilisation de l'image Node.js
FROM node:alpine

# Répertoire de travail dans le conteneur
WORKDIR /app

# Copie des fichiers nécessaires
COPY package.json package-lock.json tsconfig.json entrypoint.ts ./
COPY src/ ./src

# Installation des dépendances
RUN npm install

# Build du projet TypeScript
RUN npm run build

RUN mkdir /ontology
RUN mkdir /output_path
RUN touch /synfony_entities

# Commande d'exécution par défaut
# CMD ["node", "/app/out/index.js", "--help"]


# Commande d'exécution
ENTRYPOINT [ "node", "/app/out/entrypoint.js"]
