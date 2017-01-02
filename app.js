'use strict';
require( 'dotenv' ).config(); // environment variables

// // db connection
// const MongoClient = require( 'mongodb' ).MongoClient;
// const dbUrl = process.env.DB_URL;
// let db; // store the database connection
// MongoClient.connect( dbUrl, ( err, database ) => {
//   if ( err ) error( err );
//   db = database;
//   console.log( 'connected to db successfully' );
// });

// address to be scraped
const address = process.argv[ 2 ];

getPage( address ).then( ( response ) => {
  console.log( 'success', response );
}).catch( () => {
  console.log( 'there was a problem:', response );
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
function getThumbElements() {

}

// get the video details - link, titles, tags, description, thumburl
function getDetails() {

}

// check if last page
function checkLast() {

}

// save to database
function saveDB( data ) {
  db.collection( 'videos' ).save( data, ( err, result ) => {
    if ( err ) error( err );

    console.log( 'saved to database' );
  })
}

// generic error function, kills process when called
function error( err ) {
  console.log( 'There was an error:\n', err );
  process.exit( 1 );
}
