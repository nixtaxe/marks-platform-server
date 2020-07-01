const fs = require("fs");
const { promisify } = require("util");
const readline = require("readline");
const { google } = require("googleapis");
const FOLDER = "./api/assignment-group/services/google_spreadsheet/secrets/";
// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = FOLDER + "token.json";
const CREDENTIALS_PATH = FOLDER + "credentials.json";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Load client secrets from a local file.
module.exports = {
  async getSpreadsheetData(data) {
    const content = await readFile(CREDENTIALS_PATH).catch((err) =>
      console.log("Error loading client secret file:", err)
    );
    return await authorize(JSON.parse(content), getSpreasheetCallback(data));
  },
};

function getSpreasheetCallback(data) {
  return (auth) => getSpreadsheet(auth, data);
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  const token = await readFile(TOKEN_PATH).catch(async (err) => {
    return await getNewToken(oAuth2Client);
  });

  oAuth2Client.setCredentials(JSON.parse(token));
  return await callback(oAuth2Client);
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const question = (str) => new Promise((resolve) => rl.question(str, resolve));
  const code = await question("Enter the code from that page here: ");
  rl.close();
  const getToken = (code) => new Promise((reject, resolve) => oAuth2Client.getToken(code, (token, err) => {
    if (err) reject(err)
    resolve(token)
  }));
  const token = await getToken(code)
    .catch((err) =>
      console.log("Error while trying to retrieve access token", err)
    );
  oAuth2Client.setCredentials(token);
  await writeFile(TOKEN_PATH, JSON.stringify(token))
    .then((token) => console.log("Token stored to", TOKEN_PATH))
    .catch((err) => console.error(err));
  return token;
}

/**
 * Gets the names, assignments and results from spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function getSpreadsheet(auth, data) {
  const {integrationUrl, sheetName, upperLeftCell, lowerRightCell} = data
  const sheets = google.sheets({version: "v4", auth});
  const idExp = new RegExp("/d/([a-zA-Z0-9]*)/?");
  const spreadsheetId = idExp.exec(integrationUrl)[1];

  const resultSpreadsheet = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${upperLeftCell}:${lowerRightCell}`,
  })
  const spreadsheetValues = resultSpreadsheet.data.values

  let result = {}
  result.taskTitles = spreadsheetValues[0].slice(1, spreadsheetValues[0].length)

  result.marksTable = []
  for (let i = 0; i < spreadsheetValues.length - 1; i++) {
    result.marksTable.push([])
    for (let j = 0; j < result.taskTitles.length; j++) {
      result.marksTable[i].push('')
    }
  }

  const studentRows = spreadsheetValues.slice(1,spreadsheetValues.length)
  result.students = []
  for (const [i, row] of studentRows.entries()) {
    for (const [j, x] of row.entries()) {
      if (j === 0)
        result.students.push(x)
      else {
        result.marksTable[i][j - 1] = x
      }
    }
  }

  return result
}
