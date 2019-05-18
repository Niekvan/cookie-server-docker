FROM keymetrics/pm2:latest-alpine

WORKDIR /app

COPY package*.json ./
COPY ecosystem.config.js ./

RUN npm install

COPY . .

EXPOSE 8080

# CMD pm2-runtime start ecosystem.config.js
