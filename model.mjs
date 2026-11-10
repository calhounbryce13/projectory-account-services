/*
Author: Bryce Calhoun
Description: Backend database model for Projectory's frontend
*/

import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(
    process.env.MONGODB_CONNECT_STRING,
    { useNewUrlParser: true }
);

const db = mongoose.connection;

db.once("open", ()=>{
    console.log("\nconnected to mongodb database!");
});


////////////////////////////////////////////////////////////////


const Task = new mongoose.Schema({
    task_description: String,
    due_date: Date,
    is_complete: Number
});

const planned_projects = new mongoose.Schema({
    title: String,
    goal: String
});

const current_projects = new mongoose.Schema({
    title: String,
    goal: String,
    tasks: [Task],
    is_complete: Number,
    links: [String]
});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    passKey: Number,
    current: [current_projects],
    planned: [planned_projects],
    complete: [planned_projects]

});
////////////////////////////////////////////////////////////////

let User = mongoose.model('User', userSchema, 'user-data');

////////////////////////////////////////////////////////////////

const create_new_user = async(email, password, passKey)=>{
    const newAccount = new User({email: email, password:password, passKey:passKey, current: [], planned: [], complete:[]});
    try{
        await newAccount.save();
        return true;
    }catch(error){
        console.error(error);
        return false;
    }
}

const add_user_project = async(email, project, num)=>{
    const user = await find_existing_user(email);
    if(num == 0){
        user[0].current.push(project);
    }
    else if(num == 1){
        user[0].planned.push(project);
    }
    else if(num == 2){
        user[0].complete.push(project);
    }
    await user[0].save();
}

const check_existing_user = async(userEmail, find)=>{
    console.log("CHECKING FOR EXISTING USER", userEmail);
    let filter = {email: userEmail};
    try{
        let knownUsers = Array.from(await User.find(filter));
        if(knownUsers.length != 0){
            console.log("RESPONDING TO CONTROLLER W/ USER INFO", knownUsers);
            if(find) return knownUsers;
            return 2;
        }
    }catch(error){
        console.error(error);
        return 0;
    }
    return 1;
}

const get_my_projects = async(email, projectType)=>{
    let user = await find_existing_user(email);

    if(projectType == 'current'){
        return user[0].current;
    }
    else if(projectType == 'planned'){
        return user[0].planned;
    }
    else if(projectType == 'complete'){
        return user[0].complete;
    }
}

const add_task_to_existing_project = async(user, task, index)=>{
    const taskObject = {
        task_description: task,
        is_complete: 0
    }

    let myUser = await find_existing_user(user);
    myUser[0].current[index].tasks.push(taskObject);
    await myUser[0].save();
}

const get_amounts = async(name) => {
    let user = await find_existing_user(name);
    if(user.length > 0){
        const amounts = [];
        user = user[0];
        amounts.push(user.planned.length);
        amounts.push(user.current.length);
        amounts.push(user.complete.length);
        return amounts;
    }
    return null;
}

const update_password = async(user, newPword) => {
    try{
        await User.findOneAndUpdate({email: user}, {$set : {password: newPword}});
        return true;
    }catch(error){
        console.log(error);
    }
    return false;
};

const duplicate_exists = async(user, questionableTitle, projectSection) => {
    try{
        const accounts = await User.find({email: user});
        const userAccount = accounts[0];
        if(!(userAccount.projectSection)) throw "invalid project section passsed to duplicate check";
        Array.from(userAccount.projectSection);
        for(let i = 0; i < (userAccount.projectSection).length; i++){
            if((project.title).toLowerCase() == questionableTitle.toLowerCase()) return true;
        }
    }catch(e){
        console.error(e);
        return true;
    }
    return false;
}


////////////////////////////////////////////////////////////////

export default { 
                update_password, create_new_user, check_existing_user, 
                add_user_project, get_my_projects, add_task_to_existing_project, 
                get_amounts, duplicate_exists
                }