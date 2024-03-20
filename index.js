const fs = require('fs');
var path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const axios = require('axios');
const bodyParser = require('body-parser');
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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

app.post('/add-to-favorites', isAuthenticated, (req, res) => {
    const { title, byteSize, imageUrl } = req.body;
    console.log('Image to sent to favourites:', req.body);

    const favoritesFilePath = path.join(__dirname, 'data', 'favourites.json');
    fs.readFile(favoritesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading favorites:', err);
            return res.status(500).json({ errorMessage: 'Error reading favorites.' });
        }

        let favoritesData = JSON.parse(data);

        if (!Array.isArray(favoritesData)) {
            favoritesData = [];
        }

        const userId = req.session.userId || 'UNKNOWN';
        const firstName = req.session.firstName || 'Unknown';

        // Check if the user already exists in favorites data or create new
        let userData = favoritesData.find(user => user.user === userId);
        if (!userData) {
            userData = { name: firstName, user: userId, favoriteImages: [] };
            favoritesData.push(userData);
        }

        const isImageInFavorites = userData.favoriteImages.some(image => image.url === imageUrl && image.user === userId);

        console.log('Is image in favorites:', isImageInFavorites);

        // check if image is already saved or save image
        if (isImageInFavorites) {
            const addToFavoritesMessage = 'Image is already in favorites.';
            console.log('Image is already in favorites.');
            return res.status(500).json({ errorMessage: 'Image is already in favorites.' });
        } else {
            userData.favoriteImages.push({ title, byteSize, url: imageUrl, user: userId });

            fs.writeFile(favoritesFilePath, JSON.stringify(favoritesData, null, 2), (err) => {
                if (err) {
                    console.error('Error writing favorites:', err);
                    return res.status(500).json({ errorMessage: 'Error writing favorites.' });
                }

                const addToFavoritesMessage = 'Image added to favorites.';
                console.log('Image added to favorites.');
                return res.json({ successMessage: addToFavoritesMessage });
            });
        }
    });
});

app.get('/favourites', isAuthenticated, (req, res) => {
    const favouritesFilePath = path.join(__dirname, 'data', 'favourites.json');
    fs.readFile(favouritesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error:', err);
            res.status(500).send('Error reading json file');
            return;
        }

        const favouritesData = JSON.parse(data);
        const userId = req.session.userId || 'UNKNOWN';
        const userObject = favouritesData.find(user => user.user === userId);

        // Get the favorite images for the loggedin user
        const userFavorites = (userObject && userObject.favoriteImages) || [];

        res.render('favourites', { favoriteImages: userFavorites, userId });
    });
});

app.get('/search', isAuthenticated, (req, res) => {
    console.log("GET /search request received");
    const userId = req.session.userId || 'UNKNOWN';
    const result = { 
        title: '',
        image: {
            byteSize: ''
        },
        link: ''
    };
    res.render('search', { userId, searchResults: [], formSubmitted: false, elapsedTime: undefined, addToFavoritesMessage: '', errorMessage: '', result });
});

app.post('/search', isAuthenticated, async (req, res) => {
    const { Query } = req.body;
    const userId = req.session.userId || 'UNKNOWN';

    try {
        const startTime = Date.now(); // start time
        const apiKey = process.env.GOOGLE_APIKEY;
        const cx = process.env.GOOGLE_CX;
        const url = `${process.env.GOOGLE_URL}?q=${encodeURIComponent(Query)}&cx=${cx}&searchType=image&key=${apiKey}`;

        const response = await axios.get(url);
        const searchResults = response.data.items || [];

        const elapsedTime = (Date.now() - startTime) / 1000; // Calculate time

        const addToFavoritesMessage = req.session.addToFavoritesMessage || null;
        req.session.addToFavoritesMessage = null;

        console.log('Search results:', searchResults);

        // If the super disturbing rate limit is exceeded, set a flag to true
        if (response.status === 429) {
            return res.render('search', { 
                userId, 
                searchResults: [], 
                formSubmitted: true, 
                elapsedTime, 
                rateLimitExceeded: true,
                addToFavoritesMessage,
                errorMessage: ''
            });
        }

        res.render('search', { 
            userId, 
            searchResults, 
            formSubmitted: true, 
            elapsedTime, 
            rateLimitExceeded: false, 
            addToFavoritesMessage,
            errorMessage: ''
        });
    } catch (error) {
        console.error('Error performing image search:', error);
    
        // Check if the error is due to the disturbing rate limit
        if (error.response && error.response.status === 429) {
            return res.render('search', { 
                userId, 
                searchResults: [], 
                formSubmitted: true, 
                elapsedTime: 0, 
                rateLimitExceeded: true, 
                addToFavoritesMessage: null, 
                errorMessage: ''
            });
        }
    
        // If not rate limit exceeded
        const errorMessage = 'Internal Server Error. Please try again later.';
        res.render('search', { 
            userId, 
            searchResults: [], 
            formSubmitted: true, 
            elapsedTime: 0, 
            rateLimitExceeded: false, 
            addToFavoritesMessage: null, 
            errorMessage 
        });
    }
});

app.get('/user', isAuthenticated, (req, res) => {
    res.send(req.user);
});

app.get('/logout', (req, res) => {
    req.session.firstName = null;
    req.logout(() => {
        res.redirect('/');
    });
});

// Error handlers
app.use((req, res, next) => {
    res.status(404).render('404');
  });

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
