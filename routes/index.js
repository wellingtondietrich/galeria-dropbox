var express = require('express');
var router = express.Router();

var controller = require('../controller');

router.get('/', controller.home);

module.exports = router;

router.get('/login', controller.login);

router.get('/oauthredirect',controller.oauthredirect);