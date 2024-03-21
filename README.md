IMAGEBOT v1.0

A Node.js Express application that utilizes the EJS templating engine and integrates with Auth0.com for authentication via Google and GitHub accounts. The primary feature of the application is its ability to search for images using the Google Custom Search API, restricted to results from Unsplash.com.

Users can authenticate with their Google or GitHub accounts to access the image search functionality. Upon logging in, they can enter search queries to find images from Unsplash.com and view them directly within the application.

One of the standout features of the application is the ability for users to save their favorite images to a personalized favorites list. This list is stored in a JSON file and is accessible only to the logged-in user. Users can easily look at their saved favorite images.

This project was developed as part of a student project at Medieinstitutet in 2024

## Getting Started
To run this Node project, you first need to ensure that you have Node.js installed on your computer. Visit https://nodejs.org/ and follow the installation instructions if you don't already have Node.js installed.

### Step 1: Clone the project
Clone this project to your local computer by running the following command in the terminal.

### Step 2: Installation
run npm i to install dependencies.

IF they don't all come along, you can also run these:
npm in express express session
npm in ejs
npm in bootstrap
npm in passport passport-auth0
npm in dotenv
npm in body parser
npm in axios

### Step 3: The ENV file
Put the attached .env file in your folder root (nodeimages) - the same folder as this readme file.

### Step 4: Start
Start the application by running node index.js
