# Navidrome similarities visualizer

This project is intended to visualize the similarity between artists in your
Navidrome database. It uses a similarities API from LastFM to show artist that
are not yet in your music library to find new artists.

## How to use?

Open the [application](https://archidevil.github.io/navidrome-similars/) and
fill up the form with your Navidrome credentials and LastFM API key. Check the
connection using "Check connections" button and then click on "Load data". First
time will take a while, the more artists you have, the more calls to LastFM will
be made. Approximately 10 requests per second are made, so loading 500 artists
will take around minute or two.

When everything is loaded, the data is cached in local storage and it will not
be reloaded until you clear your cache.

You can change the similarity threshold to show more similarities.

No data is collected nor sent anywhere except your Navidrome instance and LastFM
server. This application has to server and is working in your browser.

## To run it in development mode

- Clone this repository
- Install dependencies using `npm install`
- Run `npm run dev`
- Open [http://localhost:5173/](http://localhost:5173/)
