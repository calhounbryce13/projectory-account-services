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
    return await newAccount.save();
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

const find_existing_user = async(userEmail)=>{
    let filter = {email: userEmail};
    let knownUsers = await User.find(filter);
    return knownUsers;
}

const delete_all_for_user = async(userEmail)=>{
    let filter = {email: userEmail};
    let res = await User.deleteMany(filter);
    console.log(res.deletedCount);
    return res;
}

const delete_user = async(userEmail)=>{
    let filter = {email: userEmail};
    let res = await User.deleteOne(filter);
    console.log(res.deletedCount);
    return res;
}

const get_my_projects = async(email, projectType)=>{
    let user = await find_existing_user(email);

    if(projectType == 'current'){
        return user[0].current;
    }
    else if(projectType == 'planned'){
        return user[0].planned;
    }
    else if(projectType == 'completed'){
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



//add_task_to_existing_project('calhounbryce13@gmail.com', "blah blah blah", 2);

////////////////////////////////////////////////////////////////

export default { create_new_user, find_existing_user, add_user_project, get_my_projects, add_task_to_existing_project }