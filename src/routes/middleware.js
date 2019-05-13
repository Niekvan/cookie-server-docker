const jwt = require('jsonwebtoken')

const checkToken = (req, res, next) => {
  const token = req.headers['access-token']
  if (token) {
    jwt.verify(token, process.env.JSON_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          error: 'Invalid token'
        })
      } else {
        req.decoded = decoded
        next();
      }
    })
  } else {
    return res.status(401).json({
      error: 'No auth token'
    })
  }
}

const createToken = (req, res, next) => {
  const token = jwt.sign(Math.random.toString(36).substr(2, 15), process.env.JSON_TOKEN_SECRET)
  res.json(token)
}

module.exports = {
  checkToken,
  createToken
}
