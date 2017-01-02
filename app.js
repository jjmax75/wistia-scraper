'use strict';
require( 'dotenv' ).config(); // environment variables

// db connection
const MongoClient = require( 'mongodb' ).MongoClient;
const dbUrl = process.env.DB_URL;
let db; // store the database connection
MongoClient.connect( dbUrl, ( err, database ) => {
  if ( err ) error( err );
  db = database;
  console.log( 'connected to db successfully' );
});

// address to be scraped
const address = process.argv[ 2 ];

getPage( address )
  .then( getThumbElements )
  .then( getDetails )
  .then( (response) => {
  console.log( 'got the thumb elements:', response );
  db.close();
}).catch( ( err ) => {
  error( err );
});

// get the page
function getPage( address ) {
  return new Promise(( resolve, reject ) => {
    const lib = address.startsWith( 'https' ) ? require( 'https' ) : require( 'http' );
    const request = lib.get( address, ( response ) => {

      if ( response.statusCode < 200 || response.statusCode > 299 ) {
         reject( new Error( 'Failed to load page, status code: ' + response.statusCode ));
       }

      let body = '';

      response.on( 'data', ( d ) => {
        body += d;
      });

      response.on( 'end', () => {
        resolve( body );
      });
    });

    request.on( 'error', ( err ) => {
      reject( err );
    });
  });
}

// get all thumb elements from the page
function getThumbElements( page ) {
  return new Promise(( resolve, reject ) => {
    // put regexpr in dotenv file
    const regexpr = new RegExp( process.env.REGEXPR, 'ig' );

    let matches = page.match( regexpr );
    resolve( matches );
  });
}

// get the video details - link, titles, tags, description, thumburl
function getDetails( elements ) {
  return new Promise(( resolve, reject ) => {
    let data = [];

    elements.forEach( (element) => {
      let result = {};

      const linkRegexpr = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/;
      result.link = element.match( linkRegexpr )[ 1 ];

      // todo - need to change this or make more generic
      const titleRegexpr = /<span class="video-name"><a[\s\S]+?>([\s\S]+)<\/a>/i;
      result.title = element.match( titleRegexpr )[ 1 ];

      const tagsRegexpr = /<li>(.*?)<\/li>/ig;
      result.tags = element.match( tagsRegexpr ).map( (val) => {
        return val.replace( /<\/?li>/g, '' );
      });

      const descriptionRegexpr = /<p class="video-description">(.*)<\/p/i;
      result.description = element.match( descriptionRegexpr )[ 1 ];

      const thumburlRegexpr = /<img data-src="(.*?)"/i;
      result.thumb = element.match( thumburlRegexpr )[ 1 ];

      data.push( result );

    })

    saveDB( data );

    resolve( 'all elements added to db' );
  });
}

// check if last page
function checkLast() {

}

// save to database
function saveDB( data ) {
  data.forEach( (video) => {
    db.collection( 'videos' ).save( video, ( err, result ) => {
      if ( err ) error( err );

      console.log( 'saved to database' );
    });
  });
}

// generic error function, kills process when called
function error( err ) {
  console.log( 'There was an error:\n', err );
  process.exit( 1 );
}
