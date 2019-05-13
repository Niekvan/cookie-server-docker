FROM node:11

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN npm install -g nodemon

COPY . .

EXPOSE 8081

CMD nodemon src/app.js
