const { CortiEnvironment, CortiClient } = require('@corti/sdk');

const client = new CortiClient({
  environment: CortiEnvironment.Eu,
  tenantName: process.env.CORTI_TENANT_NAME,
  auth: {
    clientId: process.env.CORTI_CLIENT_ID,
    clientSecret: process.env.CORTI_CLIENT_SECRET,
  },
});

module.exports = client;
