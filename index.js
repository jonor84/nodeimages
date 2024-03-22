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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// to use in the search
const isMisspelled = async (query) => {
    try {
        console.log('Checking spelling for:', query);
        const apiKey = process.env.GOOGLE_APIKEY;
        const cx = process.env.GOOGLE_CX;
        const url = `${process.env.GOOGLE_URL}?q=${encodeURIComponent(query)}&cx=${cx}&key=${apiKey}&spell=true`;

        const response = await axios.get(url);
        //for debug console.log('Response from Google API:', response.data);

        // Check if spelling suggestions are present in the response
        const isMisspelled = !!response.data.spelling;
        console.log('Is misspelled:', isMisspelled);

        return isMisspelled;
    } catch (error) {
        console.error('Error checking spelling:', error);
        return false;
    }
};

const getSpellSuggestions = async (query) => {
    try {
        console.log('Getting spell suggestions for:', query);
        const apiKey = process.env.GOOGLE_APIKEY;
        const cx = process.env.GOOGLE_CX;
        const url = `${process.env.GOOGLE_URL}?q=${encodeURIComponent(query)}&cx=${cx}&key=${apiKey}&spell=true`;

        const response = await axios.get(url);
        
        if (response.data.spelling && response.data.spelling.correctedQuery) {
            const correctedQuery = response.data.spelling.correctedQuery;
            console.log('Corrected query:', correctedQuery);
            return [correctedQuery];
        } else {
            console.log('No spelling suggestions found.');
            return [];
        }
    } catch (error) {
        console.error('Error getting spelling suggestions:', error);
        return [];
    }
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

    // for debug console.log("User profile:", userProfile); 
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
    try {
        console.log("GET /search request received");
        const userId = req.session.userId || 'UNKNOWN';
        res.render('search', {
            userId,
            searchResults: [],
            formSubmitted: false,
            elapsedTime: 0,
            rateLimitExceeded: false,
            addToFavoritesMessage: null,
            errorMessage: '',
            suggestions: [],
            isMisspelled: false
        });
    } catch (error) {
        console.error('Error handling GET /search:', error);
        res.status(500).json({ errorMessage: 'Internal Server Error' });
    }
});

app.post('/search', isAuthenticated, async (req, res) => {
    const { Query } = req.body;
    const userId = req.session.userId || 'UNKNOWN';

    try {
        console.log('Query:', Query);
        if (!Query) {
            return res.status(400).json({ errorMessage: 'Please provide a valid search query.' });
        }

        const startTime = Date.now(); // start time
        const apiKey = process.env.GOOGLE_APIKEY;
        const cx = process.env.GOOGLE_CX;

        // Check if the query is misspelled
        const isMisspelledValue = await isMisspelled(Query);
        let suggestions = [];

        // Proceed only if the query is not misspelled
        if (!isMisspelledValue) {
            console.log('No suggestion needed');
            const url = `${process.env.GOOGLE_URL}?q=${encodeURIComponent(Query)}&cx=${cx}&searchType=image&key=${apiKey}&spell=true`;
            const response = await axios.get(url);
            let searchResults = response.data.items || [];

            // Filter so we only get images with origin unsplash.com
            searchResults = searchResults.filter(item => {
                return item.link.includes("unsplash.com") && !item.link.includes("amazonaws.com");
            });

            const elapsedTime = (Date.now() - startTime) / 1000; // Calculate time the search took

            // Send the search results back as JSON
            return res.json({ userId, searchResults, elapsedTime, suggestions, errorMessage: null, isMisspelled: isMisspelledValue, Query });
        } else {
            console.log('Query is misspelled. No search results will be fetched.');
            suggestions = await getSpellSuggestions(Query);
            console.log('Spelling suggestions:', suggestions);
            return res.json({ userId, searchResults: [], elapsedTime: 0, suggestions, errorMessage: null, isMisspelled: isMisspelledValue, Query });
        }
    } catch (error) {
        console.error('Error performing image search:', error);
        return res.status(500).json({ errorMessage: 'Internal Server Error. Please try again later.' });
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

    // Exclude 429 errors from being handled by the global error handler
    if (err.response && err.response.status === 429) {
        return next(err); // Let it be handled by the specific route handler
    }

    res.status(500).send('Internal Server Error');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});