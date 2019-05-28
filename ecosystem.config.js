module.exports = {
  apps: [
    {
      name: 'app',
      script: './server.js',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      watch: true,
      ignore_watch: './access.log'
    }
  ]
};
