'use strict';
require( 'dotenv' ).config(); // environment variables
const http = require( 'follow-redirects' ).http;
const https = require( 'follow-redirects' ).https;
const fs = require( 'fs' );
const url = require( 'url' )

// db connection
const MongoClient = require( 'mongodb' ).MongoClient;
const dbUrl = process.env.DB_URL;
let db; // store the database connection
MongoClient.connect( dbUrl, ( err, database ) => {
  if ( err ) error( err );
  db = database;
  console.log( 'connected to db successfully' );

  // kick things off
  // main( siteAddress + currentPage + '/' );
  getIDs();
});

// address to be scraped
const siteAddress = process.argv[ 2 ];
const currentPage = process.argv[ 3 ];
let page;

function main( address ) {
  getPage( address )
    .then( getThumbElements )
    .then( getDetails )
    .then( (response) => {
      let nextPage = checkLast( page );
      if( nextPage ){
        main( siteAddress + String( nextPage ) + '/' );
      } else {
        console.log( 'all done' );
        db.close();
      }
  }).catch( ( err ) => {
    error( err );
  });
}

// get the page
function getPage( address ) {
  console.log( 'processing page:', address );
  return new Promise(( resolve, reject ) => {
    const lib = address.startsWith( 'https' ) ? https : http;
    const user = process.env.USERNAME;
    const pass = process.env.PASSWORD;
    const auth = new Buffer( user + ':' + pass ).toString( 'base64' );
    const options = {
      host: url.parse( address ).hostname,
      path: url.parse( address ).pathname,
      headers: {
        'Authorization': 'Basic ' + auth
      }
    }
    const request = lib.get( options, ( response ) => {

      if ( response.statusCode < 200 || response.statusCode > 299 ) {
         reject( new Error( 'Failed to load page, status code: ' + response.statusCode ));
       }

      let body = '';

      response.on( 'data', ( d ) => {
        body += d;
      });

      response.on( 'end', () => {
        page = body;
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
      result.link = element.match( linkRegexpr )[ 1 ] || '';

      // todo - need to change this or make more generic
      const titleRegexpr = /<span class="video-name"><a[\s\S]+?>([\s\S]+)<\/a>/i;
      result.title = element.match( titleRegexpr )[ 1 ] || '';

      const tagsRegexpr = /<li>(.*?)<\/li>/ig;
      result.tags = element.match( tagsRegexpr ).map( (val) => {
        return val.replace( /<\/?li>/g, '' );
      });

      const descriptionRegexpr = /<p class="video-description">(.*)<\/p/i;
      const descriptionElement = element.match( descriptionRegexpr );
      if( descriptionElement ) {
        result.description = descriptionElement[ 1 ];
      }

      const thumburlRegexpr = /<img data-src="(.*?)"/i;
      result.thumb = element.match( thumburlRegexpr )[ 1 ] || '';

      data.push( result );

    })

    saveDB( data );

    resolve( 'all elements added to db' );
  });
}

// check if last page
function checkLast( page ) {
  const progressElement = page.match( /<span class='pages'>(.*?)<\/span>/ )[ 1 ];
  const overallProgress = progressElement.match( /Page (\d+) of (\d+)/ );
  const currentPage = overallProgress[ 1 ];
  const lastPage = overallProgress[ 2 ];

  if ( Number( currentPage ) < Number( lastPage ) ) {
    return Number( currentPage ) + 1;
  } else {
    return false;
  }
}

// get the video ids
function getIDs() {
  db.collection( 'videos' ).find( {} ).toArray( (err, videos) => {

    // need to rate limit this (10 seconds per request?)
    function delayedLoop( i ) {
      setTimeout( () => {
        getPage( videos[ i ].link ).then( response => {
          fs.writeFile( './output', response, function(err) {
            if(err) {
                return console.log(err);
            }

            console.log("The file was saved!");
          });
          // console.log(response);
          // const idRegexpr = /wistia_async_(.*?)\s/i;
          // const id = response.match( idRegexpr )[ 1 ];
          // console.log( id );
        });
        i++;
        if( i < videos.length ) {
          delayedLoop( i );
        }
      }, (Math.random() * 6 + 10) * 1000);
    }
    delayedLoop( 0 ); //start at index 0
  });
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
