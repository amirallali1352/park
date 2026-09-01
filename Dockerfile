FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY db ./db

CMD ["npm", "run", "start:worker"]
