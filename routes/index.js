import express from 'express'
import session from 'express-session'
import { WorkOS } from '@workos-inc/node'
const app = express()
const router = express.Router()
import pkg from 'pg';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

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
const redirectURI = 'http://localhost:8000/callback'
const state = ''

router.get('/', function (req, res) {
    if (session.isloggedin) {
        res.render('login_successful.ejs', {
            profile: session.profile,
            first_name: session.first_name,
        })
    } else {
        res.render('index.ejs', { title: 'Home' })
    }
})

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

export default router
