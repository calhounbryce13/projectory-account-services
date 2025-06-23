/*
Author: Bryce Calhoun
Description: Backend account services REST API/database controller for Projectory's frontend
*/



import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import session from 'express-session';
import nodemailer from 'nodemailer';


import User from './model.mjs';

const app = express();
const PORT = process.env.PORT || 3000;
const rounds = 10;



/******************************** MIDDLEWARE ********************************************************************/

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
    secret: "something something darkside",
    saveUninitialized: false,
    resave: false,
    cookie: {
        httpOnly: true,
        secure: true,    
        sameSite: 'None'
    }
}));
app.use(cors({
    //! update for deployment
    origin: "https://calhounbryce13.github.io",
    methods: ['GET', 'POST'],
    credentials: true
}))

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


app.get('/login-status', (req, res)=>{
    if(req.session){
        console.log("\nrequest session data:",req.session)
        if(req.session.loggedIn){
            res.status(200).json(true);
            return;
        }
    }
    res.status(200).json(false);
})

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
    if(!validSession){
        res.status(400).json("invalid request session");
        return;
    }
    const email = req.session.user;
    const title = req.body['title'];
    const goal = req.body['goal'];


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

    if(!(goal == "") && !(title == "")){
        const project = {
            title: title,
            goal: goal,
            tasks: tasks,
            is_complete: 0
        };
        try{
            await User.add_user_project(email, project, 0);
            res.status(200).json("current project added");
        }catch(error){
            console.log(error);
            res.status(500).json("error");
        }
        return;
    }
    res.status(400).json({"Error": "Incomplete body"})


});

app.post('/planned-projects-generator', async(req, res)=>{
    console.log("\nplanned projects endpoint hit!\n");
    let validSession = validate_user_session(req);
    if(!validSession){
        res.status(400).json("invalid request session");
        return;
    }
    const email = req.session.user;
    const title = req.body['title'];
    const goal = req.body['goal'];
    if(!(title == "") && !(goal == "")){

        const project = {
            title: title,
            goal: goal
        };
        
        try{
            await User.add_user_project(email, project, 1);
            res.status(200).json("planned project added");
        }catch(error){
            console.log(error);
            res.status(500).json("could not add user planned project");
        }
    }
    else{
        res.status(400).json({"Error": "Incomplete body"})
    }


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
    console.log("\nlogout endpoint hit\n");
    try{
        if(req.session.loggedIn){
            req.session.destroy();
            console.log(req.session);
            res.status(200).json("logged out");
        }
        else{
            console.log("\nerroneous logout w/o login!");
        }
    }catch(error){
        console.log(error);
    }
});

app.post('/login', async(req, res)=>{
    console.log("\nlogin endpoint hit\n");
    console.log(req.body);
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
        res.status(200).send({message:"session start"});
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

const send_confirmation_email = async(email)=>{
    const subject = 'Projectory account confirmation';
    const introductoryWelcome = 'Welcome to Projectory!\nThis email is just to confirm your account registration for your records.';
    const contactReference = '\nIf you have any questions, feel free to respond to this.';
    const message = introductoryWelcome + contactReference;
    try{
        const sendEmail = await transporter.sendMail({
            from:'calhounbryce13@gmail.com',
            to: email,
            subject: subject,
            text: message
        });
        return true;
    }catch(error){
        console.log(error);
        return false;
    }
}


const setup_user_account = async(password, email, res)=>{
    let hashedPassword = await bcrypt.hash(password, rounds);
    let response;
    try{
        response = await User.create_new_user(email, hashedPassword, rounds);
        const emailSent = await send_confirmation_email(email);
        if(emailSent){
            res.status(200).json({"message":"true"});
            return;
        }
        res.status(200).json("account made successfully but error sending confirm email");
        console.log("\nnew user created", email);
        return;
    }catch(error){
        console.log(error);
        res.status(500).send({message:"error trying to create a new user"});
        return;
    }
}

/****************************************************************************************************/

app.listen(PORT,()=>{
    console.log(`server listening on port ${PORT}`);
});