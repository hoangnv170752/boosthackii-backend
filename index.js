import express from 'express'
import 'dotenv/config'
import router from './routes/index.js'
import morgan from 'morgan'
import bodyParser from 'body-parser';
// import session from 'express-session';

const app = express()

const port = 8000
app.use(bodyParser.json());

// app.use(session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: true,
//     cookie: { secure: false }
// }));

app.use('/public', express.static('public'))

app.use(express.urlencoded({ extended: false }))

app.use(express.json())

app.use(morgan('dev'))

app.use('/', router)

app.listen(port, () => {
    console.log(`⚡️ [server]: Server is running at http://localhost:${port}`)
})
