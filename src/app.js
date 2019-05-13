const express = require('express');
const bodyParser = require('body-parser');
const middleware = require('./routes/middleware');
const dbRoutes = require('./routes/db');
const morgan = require('morgan');

const mysql = require('mysql');
const redis = require('redis');
const { promisify } = require('util');
const whois = require('whois-json');

const app = express();
const port = 8080;

app.use(morgan('dev'))
app.use(bodyParser.json());

// MYSQL
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_ROOT_PASSWORD,
  database: process.env.MYSQL_DB
});

connection.connect(function(err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }

  console.log('connected as id ' + connection.threadId);
});
const query = promisify(connection.query).bind(connection);

//REDIS
const client = redis.createClient({
  host: process.env.REDIS_HOST
});
const getAsync = promisify(client.get).bind(client);
const keysAsync = promisify(client.keys).bind(client);

global.query = query
global.client = client
global.getAsync = getAsync

app.get('/', (req, res, next) => {
  res.send("OK, we're online");
});

const protectedRoutes = express.Router()
protectedRoutes.use(middleware.checkToken);
app.use('/api', protectedRoutes);

protectedRoutes.post('/test', (req, res, next) => {
  res.send('passed middleware');
})

protectedRoutes.get('/keys', async (req, res, next) => {
  const keys = await keysAsync('*');
  const data = keys.map(async key => {
    const keyData = await getAsync(key);
    return { data: JSON.parse(keyData), key };
  });
  Promise.all(data).then(completed => {
    res.json(completed.filter(item => !item.data.company))
  })
});

protectedRoutes.get('/whois/:domain', async (req, res, next) => {
  const data = await whois(req.params.domain)
  res.json(data)
})

protectedRoutes.post('/', async (req, res, next) => {
  try {
    const data = await dbRoutes.processDomain(req.body.domain);
    res.json({ ...data, cookie: req.body.domain });
  } catch (e) {
    res.json({ error: e, cookie: req.body.domain });
  }
});

protectedRoutes.get('/cookies', async (req, res, next) => {
 const data = await dbRoutes.getCookies(req.headers['map-identifier'])
 res.json({ data })
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
