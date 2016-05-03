'use strict';
/*global JSON, require, process, console*/
/*jshint latedef: false */

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||  process.env.USERPROFILE) + 
                '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

var DAY_NUMBER = {
        TWO_WEEKS: 14 - 1,
        THREE_WEEKS: 21 - 1
    },
    WORK_HOURS = {
        TWO_WEEKS: (10 -1) * 8,
        THREE_WEEKS: (15 -1) * 8
    },
    SPRINT_DURATION = 'THREE_WEEKS';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Calendar API.
    // authorize(JSON.parse(content), listEvents);
    authorize(JSON.parse(content), getFreeTime);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    /*jshint camelcase: false */
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    /*jshint camelcase: false */
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
    var calendar = google.calendar('v3');
    calendar.events.list({
        auth: auth,
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length === 0) {
            console.log('No upcoming events found.');
        } else {
            console.log('Upcoming 10 events:');
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var start = event.start.dateTime || event.start.date;
                console.log('%s - %s', start, event.summary);
            }
        }
    });
}

/**
 * Lists the next SPRINT_DURATION_WEEKS weeks events on the user's primary calendar,
 * and calculates the remaining free working time.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function getFreeTime(auth) {
    var freeTimeHours = WORK_HOURS[SPRINT_DURATION];
    var calendar = google.calendar('v3');
    var fullDaySubstracted = '';



    calendar.events.list({
        auth: auth,
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        timeMax: nDaysFromNow(DAY_NUMBER[SPRINT_DURATION]),
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length === 0) {
            console.log('No upcoming events found.');
        } else {
            console.log('Upcoming events:');
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var start = event.start.dateTime || event.start.date;
                var end = event.end.dateTime || event.end.date;
                var duration = (new Date(end) - new Date(start))/(1000*60*60);
                console.log('%s - %s - %s - %s', start, end, (((duration % 8) !== 0)? duration : 8), event.summary);
                // console.log('fullDaySubstracted', fullDaySubstracted, 'current day', start.substring(0,10));
                if(start.substring(0,10) !== fullDaySubstracted){
                    if (duration <= 8){
                        freeTimeHours -= duration;
                    } else {
                        freeTimeHours -= 8;
                        fullDaySubstracted = start.substring(0,10);
                        // console.log('Full day event ! ', fullDaySubstracted);
                    }
                } else {
                    // console.log('Ignored event in fully substracted day !!');
                }
            }
            console.log('freeTimeHours:', freeTimeHours.toFixed(2), 'over:', WORK_HOURS.THREE_WEEKS, '%:', freeTimeHours.toFixed(2)/WORK_HOURS.THREE_WEEKS*100);
        }
    });
}

function nDaysFromNow(numDays) {
    var dat = new Date();
    dat.setDate(dat.getDate() + numDays);
    return dat.toISOString();
}
