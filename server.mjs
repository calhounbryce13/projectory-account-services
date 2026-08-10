/*
Author: Bryce Calhoun
Description: Backend account services REST API/database controller for Projectory's frontend
*/

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import nodemailer from 'nodemailer';
import MongoStore from 'connect-mongo';


import User from './model.mjs';

const app = express();
const PORT = process.env.PORT || 3000;
const rounds = 10;

/******************************** MIDDLEWARE ********************************************************************/
app.set('trust proxy', 1); 
app.use(express.json());
app.use(cors({
    origin: "https://calhounbryce13.github.io",
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
}));
app.use(session({
    secret: "something something darkside",
    saveUninitialized: false,
    resave: false,
    proxy: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_CONNECT_STRING
    }),
    cookie: {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,    
        sameSite: 'none'
    }
}));


/******************************** TRANSPORTER ********************************************************************/
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth:{
        user: "calhounbryce13@gmail.com",
        pass: process.env.EMAIL_PASSWORD
    }
})


/******************************** ROUTE HANDLERS ********************************************************************/

app.put('/update-password', async(req, res) => {
    const user = req.body["user"];
    const newPword = req.body["newPword"];

    if(user && newPword){
        const hashedPassword = await bcrypt.hash(newPword, 12);
        const result = await User.update_password(user, hashedPassword);
        res.sendStatus(200);
        return;
    }
    res.status(400).json("error: invalid body");
    return;

});

app.get('/server-status', (req, res) => {
    res.status(200).json({"status":"OK"});
});

app.get('/login-status', (req, res)=>{
    if(req.session){
        console.log("\nrequest session data:",req.session)
        if(req.session.loggedIn){
            res.status(200).json(true);
            return;
        }
    }
    res.status(200).json(false);
});

app.get('/get-user-email', (req, res)=>{

    try{
        res.status(200).json(req.session.user);
    }catch(error){
        res.status(500).json('null');
    }
});

app.post('/projects-view', async(req, res)=>{
    console.log("\nprojects view endpoint hit!\n");
    console.log(req.session);
    let validSession = validate_user_session(req);
    if(!validSession){
        res.status(400).json("invalid request session");
        return;
    }
    let projects = [];
    try{
        projects = await User.get_my_projects(req.session.user, req.body['project-type']);
        res.status(200).json(projects);
    }catch(error){
        console.log(error);
        res.status(500).json("error getting user projects");
    }
});

app.post('/current-projects-generator', async(req, res)=>{
    let validSession = validate_user_session(req);
    if(validSession){
        const email = req.session.user;
        const title = req.body['title'];
        const goal = req.body['goal'];
        if(!(User.duplicate_exists(email, title, "current"))){
            const tasks = [];
            const tasklist = req.body['tasks'];
            for(let i = 0; i < tasklist.length; i++){
                const task_description = tasklist[i]
                let task = {
                    task_description: task_description,
                    due_date: null,
                    is_complete: 0
                }
                tasks.push(task)
            }
            if((goal != "") && (title != "")){
                const project = {
                    title: title,
                    goal: goal,
                    tasks: tasks,
                    is_complete: 0
                };
                try{
                    await User.add_user_project(email, project, 0);
                    res.status(201).json("current project added");
                }catch(error){
                    console.log(error);
                    res.status(500).json({"Error": "Server error creating the project"});
                }
                return;
            }
            res.status(400).json({"Error": "Incomplete body"});
            return;
        }
        res.status(409).json({"Error": "Duplicate exists in the same section"});
        return;
    }
    res.status(401).json({"Error": "Invalid request session"});
    return;

});

app.post('/planned-projects-generator', async(req, res)=>{
    let validSession = validate_user_session(req);
    if(validSession){
        const email = req.session.user;
        const title = req.body['title'];
        const goal = req.body['goal'];
        if(!(User.duplicate_exists(email, title, "planned"))){
            if((title != "") && (goal != "")){
                const project = {
                    title: title,
                    goal: goal
                };
                try{
                    await User.add_user_project(email, project, 1);
                    res.status(200).json("planned project added");
                }catch(e){
                    console.error(e);
                    res.status(500).json({"Error": "Issue adding the planned project"});
                }
                return;
            }
            res.status(400).json({"Error": "Missing title and/or goal"});
            return;
        }
        res.status(409).json({"Error": "Duplicate exists in the same section"})
    }
    res.status(401).json({"Error": "Invalid request session"});
    return;
});

app.post('/subtask-generator', (req, res)=>{
    if(req.body && validate_user_session(req)){
        if((req.body['new task']) && (req.body['index'] != null)){
            if((req.body['new task'] != "") && (typeof(req.body['index']) == 'number')){
                User.add_task_to_existing_project(req.session.user, req.body['new task'], req.body['index']);
                res.status(200).json("success!");
                return;
            }
        }
    }
    res.status(400).json({"error": "bad request"});
});

app.post('/logout', (req, res)=>{
    if(req.session){
        if(req.session.loggedIn){
            req.session.destroy();
            res.status(200).json("logged out");
        }
        else{
            console.log("\nerroneous logout w/o login!");
        }
        return;
    }
    res.status(400).json("error: no valid session object");
    return;

});

app.post('/login', async(req, res)=>{
    console.log("\nlogin endpoint hit\n");
    const userEmail = req.body['userEmail'];
    const plainTextPassword = req.body['userPassword'];
    if(userEmail && plainTextPassword){
        let alreadyHasAccount = await check_for_existing_email(userEmail);
        console.log(alreadyHasAccount);
        if(alreadyHasAccount == true){
            let validPassword = await validate_user_password(plainTextPassword, userEmail);
            if(validPassword){
                session_start(req, res, userEmail);
            }
            else{
                res.status(200).send({message:"invalid username and/or password (password)"});
            }
            return;
        }
        else if(alreadyHasAccount == false){
            res.status(200).send({message: "invalid username and/or password"});
            return;
        }
        else{
            return;
        }
    }
    res.status(400).send({message: "error missing email and/or password"});
    return;

});

app.post('/registration', async(req, res)=>{
    if(req.body){
        const email = req.body['userEmail'];
        const password = req.body['userPassword'];
        if(email && password){
            let alreadyHasAccount = await check_for_existing_email(email);
            if(alreadyHasAccount == false){
                setup_user_account(password, email, res);
                return;
            }
            else if(alreadyHasAccount == true){
                res.status(200).json({message:"already has an account"});
                return;
            }
            else{
                res.status(500).send({message:"server error"});
            }
            return;
        }
        res.status(400).send({message: "error missing email and/or password"});
        return;
    }
    res.status(400).send({message: "error no request body"});
});

app.get('/get-amounts', async(req, res) => {
    if(req.session){
        if(req.session.user){
            const data = await User.get_amounts(req.session.user);
            if(data != null){
                res.status(200).json(data);
                return;
            }
            res.status(500).json({'error': 'issue communicating with database'});
        }
    }
    res.status(400).json({'error': 'invalid session'});
    return;
})


/******************************** HELPER FUNCTIONS ********************************************************************/


const validate_user_session = function(req){
    if(req.session){
        if(req.session.loggedIn && (req.session.user != '')){
            return true;
        }
    }
    return false
}

const session_start = function(req, res, email){
    if(!(req.session.loggedIn)){
        req.session.loggedIn = true;
        req.session.user = email;
        req.session.save(err => {
            if(err){
                res.status(500).json({ error: "Session not saved" });
                return;
            }
            res.status(200).send({message:"session start"});
            return;
        });
    }
    else{
        console.log(`${email},\nalready logged in!`);
        res.status(200).json("user already logged in");
    }
    return;
}

const validate_user_password = async(plainTextPassword, userEmail)=>{
    let userAccount = await User.find_existing_user(userEmail);
    const hashedPassword = userAccount[0].password;

    let valid;
    try{
        valid = await bcrypt.compare(plainTextPassword, hashedPassword);
    }catch(error){
        console.log(error);
        return null;
    }
    if(valid){
        return true;
    }
    return false;
}

const check_for_existing_email = async(userEmail)=>{
    let accounts;
    try{
        accounts = await User.find_existing_user(userEmail);
    }catch(error){
        console.log(error);
        res.status(500).send({message: "could not verify user credentials!"});
        return null;
    }
    if(accounts.length == 0){
        return false;
    }
    return true;
}

const setup_user_account = async(password, email, res)=>{
    let hashedPassword = await bcrypt.hash(password, rounds);
    let response;
    try{
        response = await User.create_new_user(email, hashedPassword, rounds);
        res.sendStatus(201);
        console.log("\nnew user created", email);
        return;
    }catch(error){
        console.error(error);
        res.status(500).send({"Error":"Issue trying to create a new user"});
        return;
    }
}

/****************************************************************************************************/

app.listen(PORT,()=>{
    console.log(`server listening on port ${PORT}`);
});