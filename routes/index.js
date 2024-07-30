import express from 'express'
import session from 'express-session'
import { WorkOS } from '@workos-inc/node'
const app = express()
const router = express.Router()
import pkg from 'pg';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

const { Pool } = pkg;
dotenv.config();
app.use(
    session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: true },
    })
)

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.SECRET_ID,
  process.env.REDIRECT
);



const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const getUserById = async (id) => {
    const query = 'SELECT * FROM users WHERE id = $1';
    const values = [id];
  
    try {
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (err) {
      console.error(err);
      throw new Error('Error fetching user');
    }
};

const getUsers = async () => {
  const query = 'SELECT * FROM users';

  try {
    const res = await pool.query(query);
    return res.rows;
  } catch (err) {
    console.error(err);
    throw new Error('Error fetching user');
  }
};
  
const createUser = async (profile) => {
    const query = `
      INSERT INTO users (id, email, first_name, last_name, connection_id, connection_type, idp_id, raw_attributes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        connection_id = EXCLUDED.connection_id,
        connection_type = EXCLUDED.connection_type,
        idp_id = EXCLUDED.idp_id,
        raw_attributes = EXCLUDED.raw_attributes
      RETURNING *;
    `;
    
    const values = [
      profile.id,
      profile.email,
      profile.first_name,
      profile.last_name,
      profile.connection_id,
      profile.connection_type,
      profile.idp_id,
      profile.raw_attributes,
    ];
  
    try {
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (err) {
      console.error(err);
      throw new Error('Error creating or updating user');
    }
  };
  

const workos = new WorkOS(process.env.WORKOS_API_KEY)
const clientID = process.env.WORKOS_CLIENT_ID
const organizationID = 'org_01J25MWRKQ31M7R3N081H1XDMM'
const redirectURI = 'https://digitaldev.io.vn/callback'
// const redirectURI = 'http://localhost:8000/callback'

const state = ''

router.get('/sso', function (req, res) {
    if (session.isloggedin) {
        res.render('login_successful.ejs', {
            profile: session.profile,
            first_name: session.first_name,
        })
    } else {
        res.render('index.ejs', { title: 'Home' })
    }
})

// GET users 
router.get('/users', async (req, res)  => {
    var email = req.query.filter;
    let users = await getUsers();
    var userRes = []
    if (email) {
      userRes.push(users.filter((item) => item?.email == email))

      res.send( {users: userRes[0]} )
    } else {
      res.send( { users })
    }
});

// GET 1 user

router.post('/login', (req, res) => {
    const login_type = req.body.login_method

    const params = {
        clientID: clientID,
        redirectURI: redirectURI,
        state: state,
    }

    if (login_type === 'saml') {
        params.organization = organizationID
    } else {
        params.provider = login_type
    }

    try {
        const url = workos.sso.getAuthorizationURL(params)

        res.redirect(url)
    } catch (error) {
        res.render('error.ejs', { error: error })
    }
})

router.get('/', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', 
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });
  res.redirect(url);
})

router.get('/redirect', async (req, res) => {
  const code = req.query.code;
  // Exchange the code for tokens
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      // Handle error if token exchange fails
      console.error('Couldn\'t get token', err);
      res.send('Error');
      return;
    }
    // Set the credentials for the Google API client
    console.log(tokens);
    oauth2Client.setCredentials(tokens);
    // Notify the user of a successful login
    res.send('Successfully logged in');
  });
});

router.get('/callback', async (req, res) => {
  let errorMessage;
  try {
    const { code, error } = req.query;

    if (error) {
      errorMessage = `Redirect callback error: ${error}`;
      res.render('error.ejs', { error: errorMessage });
    } else {
      const profile = await workos.sso.getProfileAndToken({
        code,
        clientID,
      });

      let user = await getUserById(profile.profile.id);
      console.log('----->');
      console.log(user);
      if (!user) {
        user = await createUser(profile.profile);
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      console.log('-+++++++--->');

      // req.session.first_name = profile.first_name;
      // req.session.profile = JSON.stringify(profile, null, 4);
      // req.session.isloggedin = true;

      res.render('login_successful.ejs', {
          profile: user,
          first_name: user.first_name,
          token: token
      })
      // res.status(200).json({ token });
    }
  } catch (error) {
    errorMessage = `Error exchanging code for profile: ${error.message}`;
  }


})


router.get('/logout', async (req, res) => {
    try {
        session.first_name = null
        session.profile = null
        session.isloggedin = null

        res.redirect('/')
    } catch (error) {
        res.render('error.ejs', { error: error })
    }
})

// TEST Google Calendar API
router.get('/calendars', (req, res) => {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  calendar.calendarList.list({}, (err, response) => {
    console.log(response);
    if (err) {
      console.error('Error fetching calendars', err);
      res.end('Error!');
      return;
    }
    const calendars = response.data.items;
    res.json(calendars);
  });
});

router.get('/events', (req, res) => {
  const calendarId = req.query.calendar ?? 'primary';
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  calendar.events.list({
    calendarId,
    timeMin: (new Date()).toISOString(),
    maxResults: 15,
    singleEvents: true,
    orderBy: 'startTime'
  }, (err, response) => {
    if (err) {
      console.error('Can\'t fetch events');
      res.send('Error');
      return;
    }
    const events = response.data.items;
    res.json(events);
  });
});

export default router
