const express = require('express');
const session = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Configuration
const strategy = new Auth0Strategy({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  callbackURL: process.env.AUTH0_CALLBACK_URL
}, (accessToken, refreshToken, extraParams, profile, done) => {
  return done(null, profile);
});

passport.use(strategy);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Routes
app.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.redirect('/main');
    } else {
        res.render('home');
    }
});

app.get('/login', passport.authenticate('auth0', {
    scope: 'openid email profile'
}));

app.get('/callback', passport.authenticate('auth0', {
    failureRedirect: '/login',
}), (req, res) => {
    res.redirect('/main');
});

app.get('/main', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.render('main');
    } else {
        res.redirect('/');
    }
});

app.get('/user', (req, res) => {
    res.send(req.user);
});

app.get('/logout', (req, res) => {
    req.logout(() => {
      res.redirect('/');
    });
  });

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});