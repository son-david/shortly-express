var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'david',
  resave : false,
  saveUninitialized : true
}));

// G E T // // // // // // // // // // // // // // // // // // // // // // // // //
//
//
//

app.get('/', util.CheckUser,
function(req, res) {
  res.render('index'); 
});

app.get('/create', util.CheckUser,
function(req, res) {
  res.render('index');
});

app.get('/links', util.CheckUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/login',
function(req, res) {
  res.render('login'); 
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/failed',
function(req,res){
  res.render('failed');
});

// P O S T // // // // // // // // // // // // // // // // // // // // // // // //  
//
//
//

app.post('/links', util.CheckUser,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

app.post('/signup',
function(req,res){
  var username = req.body.username;
  var password = req.body.password;

  new User({username : username}).fetch().then(function(found) {
    if (found) {
      res.redirect('/'); 
    } else {
      Users.create({
        username: username,
        password: password,
        salt: null
      })
      .then(function(newUser) {
        util.createSession(newUser.username)
      })

    }
  })
});

app.post('/login', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  

  new User({username : username}).fetch().then(function(found) {
    if (found){
      var hash = bcrypt.hashSync(password, found.attributes.salt);
      if (found.attributes.password === hash) {
        req.session.user = found.attributes.username;
        res.redirect('/');
      } else {
        res.redirect('/failed'); 
      }
    } else {
      res.redirect('/failed');
    }
  })
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
