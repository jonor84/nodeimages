const fs = require('fs');
var path = require('path');
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
app.set('views', path.join(__dirname, 'views'));

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

// check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next(); 
    }
    res.redirect('/'); // User is not authenticated, redirect to home
};

// Routes
app.get('/', (req, res) => {
    // Check if user is authenticated
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
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
    const userProfile = req.user;
    let firstName;
    let userId;

    if (userProfile.provider === 'google-oauth2') {
        firstName = userProfile._json.given_name;
        userId = userProfile.user_id;
    } else if (userProfile.provider === 'github') {
        firstName = userProfile.nickname;
        userId = userProfile.user_id;
    } else {
        firstName = 'NONAME';
        userId = 'UNKNOWN';
    }

    console.log("User profile:", userProfile);
    console.log("User profile provider:", userProfile.provider);
    console.log("User id:", userId);

    // Store firstName and email in session
    req.session.firstName = firstName;
    req.session.userId = userId;
    console.log("First name and userid stored in session:", firstName, userId);

    res.redirect('/dashboard');
});



app.get('/dashboard', isAuthenticated, (req, res) => {
    const firstName = req.session.firstName || 'NONAME';
    res.render('dashboard', { firstName: firstName });
});


app.get('/test', isAuthenticated, (req, res) => {
    res.render('test');
});

app.get('/favourites', isAuthenticated, (req, res) => {
    const favouritesFilePath = path.join(__dirname, 'data', 'favourites.json');
    fs.readFile(favouritesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading favourites file:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const favouritesData = JSON.parse(data);

        // Get the right images for the loggedin user
        const userId = req.session.userId || 'UNKNOWN';
        const userFavorites = favouritesData.favoriteImages.filter(image => image.user === userId);

        res.render('favourites', { favoriteImages: userFavorites, userId });
    });
});

app.get('/search', isAuthenticated, (req, res) => {
    const userId = req.session.userId || 'UNKNOWN';
    res.render('search', { userId });
});

app.get('/user', (req, res) => {
    res.send(req.user);
});

app.get('/logout', (req, res) => {
    req.session.firstName = null;
    req.logout(() => {
        res.redirect('/');
    });
});

app.use((req, res, next) => {
    res.status(404).render('404');
  });

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
